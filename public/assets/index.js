const messages  = new Set

const polling   = new Set

const connected = new Set

const typingMessage = document.querySelector('.typing-message')

let usersLength = 0

let typingCount = 0

const createMessage = function(message){
  if(!messages.has(message.id)){
    messages.add(message.id)
    const {
      name,
      time,
      text,
    } = message
    
    const wrapper = document.createElement('li'),
          body    = document.createElement('div'),
          title   = document.createElement('div'),
          textEl  = document.createElement('div')

    wrapper.appendChild(body)
    body.appendChild(title)
    body.appendChild(textEl)

    wrapper.classList.add('message', `message_${name === localStorage.userName ? 'outgoing' : 'incoming'}`)
    body.classList.add('message__body')
    title.classList.add('message__title')
    textEl.classList.add('message__text')

    title.innerHTML   = `${name} <span>${time}</span>`
    textEl.innerText  = text
    
    document.querySelector('.messages__list').insertBefore(wrapper, typingMessage)
    document.querySelector('.messages__list').scrollTop = document.querySelector('.messages__list').scrollHeight
  }
}

const guid    = function(){
  function s4() {
    return Math.floor((1 + Math.random()) * 0x10000)
      .toString(16)
      .substring(1);
  }

  return s4() + s4() + '-' + s4() + '-' + s4() + '-' +
    s4() + '-' + s4() + s4() + s4();
}

const addMessage = function(message){
  const wrapper = document.createElement('li'),
        body    = document.createElement('div'),
        textEl  = document.createElement('div')

  wrapper.appendChild(body)
  body.appendChild(textEl)

  wrapper.classList.add('message', `message_system`)
  body.classList.add('message__body')

  textEl.innerText  = message

  document.querySelector('.messages__list').insertBefore(wrapper, typingMessage)
  document.querySelector('.messages__list').scrollTop = document.querySelector('.messages__list').scrollHeight
}

const updateUsersList = function(users){
  const fragment    = document.createDocumentFragment(),
        usersList   = document.querySelector('.users'),
        names       = users.map(u => u.name);

  const newConnections = names.filter(name => {
    return !connected.has(name) && name !== localStorage.userName
  })

  const disconnected    = Array.from(connected).filter(name => {
    return names.indexOf(name) < 0 && name !== localStorage.userName
  })

  usersLength = users.length
  connected.clear()

  for(let user of users){
    connected.add(user.name)

    const li = document.createElement('li')
    li.textContent = user.name

    if(user.name === localStorage.userName){
      const button = document.createElement('button')
      button.classList.add('disconnect')
      button.textContent = "Disconnect"
      li.appendChild(button)
    }

    fragment.appendChild(li)
  }

  if(newConnections){
    for(let name of newConnections){
      addMessage(`${name} joined chat`)
    }
  }

  if(disconnected){
    for(let name of disconnected){
      addMessage(`${name} leaved chat`)
    }
  }
  
  usersList.innerHTML = ""
  usersList.appendChild(fragment)
}

const renderTyping = function(users){
  if(users.length){
    console.log(typingMessage)
    if(users.length > 1){
      typingMessage.textContent = `${users[0]} and ${users.length - 1} are typing...`
    } else {
      typingMessage.textContent = `${users[0]} is typing...`
    }
    typingMessage.hidden = false
  } else {
    typingMessage.hidden = true
  }
}

const startMessagePolling = function(){
  if(!polling.has('messages')){
    polling.add('messages');

    (function pollMessages(){
      request('GET', `/messages?user=${localStorage.userName}`).then(response => {
        if(response.messages && response.messages.length){
          response.messages.forEach(createMessage)
        }

        setTimeout(pollMessages, 10)
      })
    })();
  }
}

const startUsersPolling = function(){
  if(!polling.has('users')){
    polling.add('users');

    (function pollUsers(){
      request('GET', `/users?count=${usersLength}`).then(response => {
        if(response.users && response.users.length){
          updateUsersList(response.users)
        }

        setTimeout(pollUsers, 10)
      })
    })();
  }
}

const startTypingPolling = function(){
  if(!polling.has('typing')){
    polling.add('typing');

    (function pollUsers(){
      request('GET', `/typing?user=${localStorage.userName}&count=${typingCount}`).then(response => {
        if(response.typing && response.typing.length !== typingCount){
          typingCount = response.typing.length
          renderTyping(response.typing)
        }

        setTimeout(pollUsers, 10)
      })
    })();
  }
}

const request = function(type, url, data = {}){
  return new Promise(resolve => {
    const xhr = new XMLHttpRequest

    xhr.open(type, url)

    xhr.timeout = 40000

    xhr.setRequestHeader('Content-type', 'application/json')

    xhr.onreadystatechange = function(){
      if(xhr.readyState === 4){
        resolve(JSON.parse(xhr.responseText))
      }
    }

    xhr.ontimeout = function(){
      resolve({ timeout: true })
    }

    xhr.send(JSON.stringify(data))
  }).catch(err => console.log(err))
}

const initPolling = function(){
  startMessagePolling()
  startTypingPolling()
  startUsersPolling()
}

document.addEventListener('input', e => {
  if(e.target.className === 'new-message__input'){
    request('POST', '/typing', {
      user: localStorage.userName
    })
  }
})

document.addEventListener('submit', e => {
  if(e.target.nodeName === 'FORM'){
    e.preventDefault()
    e.stopPropagation()
    
    switch(e.target.className){
      case 'new-message': return (function(form){
        const message         = form.querySelector('input').value

        if(message.trim().length > 0){
          const messageData     = {
                  id    : guid(),
                  time  : Date.now(),
                  name  : localStorage.userName,
                  text  : message
                }
          
          createMessage(messageData)

          request('POST', '/message', {
            message: messageData
          })

          form.reset()
        }
      })(e.target)

      case 'register__form': return (function(form){
        const {value: name} = form.querySelector('input')
        localStorage.setItem('userName', name)

        request('POST', '/register', {
          user: name
        }).then(r => {
          if(r.success){
            updateUsersList(r.users)
            initPolling()
            document.querySelector('.register').hidden = true
          }
        })

      })(e.target)
    }
  }
}, true)

document.addEventListener('click', e => {
  if(e.target.nodeName === 'BUTTON' && e.target.className === 'disconnect'){
    request('POST', '/unregister', {
      user: localStorage.userName
    }).then(() => {
      localStorage.removeItem('userName')
      location.reload()
    })
  }
})

if(!localStorage.userName){
  document.querySelector('.register').hidden = false
} else {
  request('POST', '/register', {
    user: localStorage.userName
  }).then(() => {
    request('GET', '/all_users').then(r => updateUsersList(r.users))
    request('GET', `/all_messages?user=${localStorage.userName}`).then(r => r.messages.forEach(createMessage))
    initPolling()
  })
}

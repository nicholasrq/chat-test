const fs          = require('fs'),
      path        = require('path'),
      http        = require('http'),
      express     = require('express'),
      stylus      = require('express-stylus'),
      bodyParser  = require('body-parser');

const server  = http.createServer(),
      app     = express()

const guid    = function(){
  function s4() {
    return Math.floor((1 + Math.random()) * 0x10000)
      .toString(16)
      .substring(1);
  }

  return s4() + s4() + '-' + s4() + '-' + s4() + '-' +
    s4() + '-' + s4() + s4() + s4();
}

const users       = []

const messages    = []

const newMessages = []

const gotMessages = new Map

const typing = new Map

let prevMessagesLength    = 0;

app.use(stylus({
  src   : path.join(__dirname, 'public', 'assets'),
  dest  : path.join(__dirname, 'public', 'assets')
}))

app.use('/', express.static(`${__dirname}/public`))

app.use(bodyParser.json({limit: '50mb'}))

app.use(bodyParser.urlencoded({ extended: true }))

app.post('/message', (req, res) => {
  const {message} = req.body
  
  messages.push(message)

  res.status(200).send({success: true})
})

app.get('/all_messages', (req, res) => {
  const ids = new Set(messages.map(m => m.id))
  gotMessages.set(req.query.user, ids)
  res.status(200).send({ messages })
})

app.get('/messages', (req, res) => {
  const start   = Date.now(),
        user    = req.query.user;

  (function watcher(){
    if(messages.length != gotMessages.get(user).size){
      console.log(`Got ${messages.length - prevMessagesLength} messages`)
      const msgs = messages.filter(m => {
        if(!gotMessages.get(user).has(m.id)){
          gotMessages.get(user).add(m.id)
          return true
        } else {
          return false
        }
      })

      prevMessagesLength = messages.length
      res.status(200).send({messages: msgs})
    } else if((Date.now() - start) >= 3000){
      console.log('No messages for 3 seconds')
      res.status(200).send({messages: []})
    } else {
      setTimeout(watcher, 10)
    }
  })();
})

app.get('/all_users', (req, res) => {
  res.status(200).send({
    success   : true,
    users     : users
  })
})

app.get('/users', (req, res) => {
  const start   = Date.now();

  (function watcher(){
    if(String(users.length) !== String(req.query.count)){
      res.status(200).send({users: users})
    } else if((Date.now() - start) >= 3000){
      res.status(200).send({users: []})
    } else {
      setTimeout(watcher, 10)
    }
  })();
})

app.post('/register', (req, res) => {
  const {user} = req.body


  if(users.find(u => u.name === user)){
    res.status(200).send({
      success   : false,
      users     : null
    })
  } else {
    users.push({
      id: guid(),
      name: user
    })

    res.status(200).send({
      success   : true,
      users     : users
    })
  }
})

app.post('/unregister', (req, res) => {
  const {user} = req.body,
        current = users.find(u => u.name === user);
  

  if(current){
    users.splice(users.indexOf(current), 1)
    res.status(200).send({
      success   : true
    })
  } else {
    res.status(200).send({
      success   : false
    })
  }
})

app.get('/typing', (req, res) => {

  const start   = Date.now();

  const {user, count} = req.query;

  (function watcher(){
    // console.log(String(typing.size), String(count))
    if(String(typing.size) !== String(count)){
      res.status(200).send({
        typing: Array.from(typing.keys()).filter(n => n !== user)
      })
    } else if((Date.now() - start) >= 3000){
      res.status(200).send({
        typing: []
      })
    } else {
      setTimeout(watcher, 10)
    }
  })();
})

app.post('/typing', (req, res) => {
  clearTimeout(typing.get(req.body.user))

  typing.set(req.body.user, setTimeout(function(){
    console.log('removed')
    typing.delete(req.body.user)
  }, 2000))

  res.status(200).send({success: true})
})

server.on('request', app)
server.listen(3000, () => {
  console.log('Chat App listening on port 3000')
})

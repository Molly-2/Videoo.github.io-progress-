const express = require('express');
const socketio = require('socket.io');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const bodyParser = require('body-parser');

const app = express();
const PORT = process.env.PORT || 3000;

const upload = multer({ dest: 'uploads/' });

app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use(bodyParser.json());

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.post('/upload', upload.single('media'), (req, res) => {
  if (req.file) {
    const post = {
      id: Date.now(),
      title: req.body.title,
      url: `/uploads/${req.file.filename}`,
      type: req.file.mimetype.split('/')[0],
      timestamp: new Date(),
      username: req.body.username,
      comments: []
    };

    fs.readFile('posts.json', (err, data) => {
      const posts = err ? [] : JSON.parse(data);
      posts.push(post);

      fs.writeFile('posts.json', JSON.stringify(posts), (err) => {
        if (err) {
          res.status(500).json({ error: 'Failed to save post' });
        } else {
          res.json(post);
          io.emit('newPost', post); // Emit new post to all connected clients
        }
      });
    });
  } else {
    res.status(400).json({ error: 'No file uploaded' });
  }
});

app.post('/comment', (req, res) => {
  const { postId, username, comment } = req.body;

  fs.readFile('posts.json', (err, data) => {
    if (err) {
      res.status(500).json({ error: 'Failed to load posts' });
      return;
    }

    const posts = JSON.parse(data);
    const post = posts.find(post => post.id === postId);

    if (post) {
      post.comments.push({ username, comment, timestamp: new Date() });

      fs.writeFile('posts.json', JSON.stringify(posts), (err) => {
        if (err) {
          res.status(500).json({ error: 'Failed to save comment' });
        } else {
          res.json(post);
          io.emit('newComment', { postId, comment: { username, comment, timestamp: new Date() } }); // Emit new comment to all connected clients
        }
      });
    } else {
      res.status(404).json({ error: 'Post not found' });
    }
  });
});

app.get('/posts', (req, res) => {
  fs.readFile('posts.json', (err, data) => {
    if (err) {
      res.json([]);
    } else {
      res.json(JSON.parse(data));
    }
  });
});

app.get('/search', (req, res) => {
  const { title } = req.query;

  fs.readFile('posts.json', (err, data) => {
    if (err) {
      res.json([]);
    } else {
      const posts = JSON.parse(data);
      const filteredPosts = posts.filter(post => post.title.toLowerCase().includes(title.toLowerCase()));
      res.json(filteredPosts);
    }
  });
});

const server = app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

const io = socketio(server);

io.on('connection', (socket) => {
  console.log('Connected to ' + socket.id);

  fs.readFile('text.txt', 'utf8', (err, data) => {
    if (err) {
      console.error(err);
    } else {
      socket.emit('history', data.split('\n').filter(line => line).map(line => JSON.parse(line)));
    }
  });

  socket.on('sendMessage', (message) => {
    io.emit('receiveMessage', message);
    fs.appendFile('text.txt', JSON.stringify(message) + '\n', (err) => {
      if (err) {
        console.error(err);
      }
    });
  });

  socket.on('like', (likeData) => {
    io.emit('like', likeData);
  });

  socket.on('disconnect', () => {
    console.log('Disconnected from ' + socket.id);
  });
});

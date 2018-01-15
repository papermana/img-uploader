const path = require('path');
const crypto = require('crypto');
const express = require('express');
const fileUpload = require('express-fileupload');
const dotenv = require('dotenv');
const firebaseAdmin = require('firebase-admin');

dotenv.config();
firebaseAdmin.initializeApp({
  credential: firebaseAdmin.credential.cert({
    projectId: process.env.FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: process.env.FIREBASE_PRIVATE_KEY,
  }),
  databaseURL: process.env.FIREBASE_DATABASE_URL,
});

const app = express();
const bucket = firebaseAdmin
      .storage()
      .bucket(process.env.FIREBASE_STORAGE_BUCKET);

app.use(fileUpload());
app.use(express.static('public'));

const uploadFile = (name, buffer, mimetype) => {
  return new Promise((resolve, reject) => {
    const stream = bucket
          .file(name)
          .createWriteStream({
            metadata: { metadata: { mimetype } },
            resumable: false,
          });

    stream.on('error', reject);
    stream.on('finish', resolve);
    stream.end(buffer);
  })
    .then(() => {
      return bucket.file(name).makePublic();
    });
};

app.post('/api/upload-image', (req, res) => {
  const file = req.files.image;
  const hash = crypto.createHash('sha1');

  hash.update(file.data);

  const hashedFile = hash.digest('hex');

  bucket
    .file(hashedFile)
    .exists()
    .then(([exists]) => {
      if (exists) {
        return;
      }

      return uploadFile(hashedFile, file.data, file.mimetype);
    })
    .then(() => {
      res.redirect(`/${hashedFile}`);
    })
    .catch(err => {
      console.log('Error saving the image');
      console.log(err);
      res.send('Sorry, something bugged out!');
    })
});

app.get('/:hash', (req, res) => {
  const hash = req.params.hash;

  bucket
    .file(hash)
    .get()
    .then(([_, apiResponse]) => {
      res.send(`<html><body><img src="${apiResponse.mediaLink}">`);
    })
    .catch(err => {
      console.log('Error rendering the image')
      console.log(req.params.hash);
      console.log(err);
      res.send('Sorry, something bugged out!');
    });
});

app.listen(process.env.PORT, () => {
  console.log(`img-uploader is now listening on port ${process.env.PORT}`);
});

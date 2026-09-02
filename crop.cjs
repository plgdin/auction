const Jimp = require('jimp');

Jimp.read('public/logo.png')
  .then(image => {
    image.autocrop().write('public/logo_cropped.png');
    console.log('Successfully cropped logo.png to logo_cropped.png');
  })
  .catch(err => {
    console.error('Error cropping image:', err);
  });

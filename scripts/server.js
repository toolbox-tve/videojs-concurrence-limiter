const app = require('express')();
const bodyParser = require('body-parser');
const cors = require('cors');

app.use(bodyParser.json());
app.use(cors({ origin: true, credentials: true }));

let counter = 4;

app.post('/canplay', (req, res) => {
  setTimeout(() => res.json({
    success: true,
    player: 'ssi-b7ture9aj'
  }), 1000);
});

app.post('/nowplaying', (req, res) => {
  setTimeout(() => res.json({
    success: true,
    player: 'ssi-b7ture9aj'
  }), 150000);
  /* if (counter > 0) {
    counter = counter - 1;
    res.sendStatus(400);
  } else {
    counter = 4;
    res.json({
      success: true,
      player: 'ssi-b7ture9aj'
    });
  } */

});

app.post('/stop', (req, res) => {
  res.json({
    success: true,
    player: 'ssi-b7ture9aj'
  });
});


app.listen(55555, () => {
  console.log(`> Running on localhost:55555c`);
});
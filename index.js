const request = require('unirest');
const JSONdb = require('simple-json-db');
const db = new JSONdb('./db.json');
const fs = require('fs');
const mailgun = require('mailgun-js');
require('dotenv-safe').config({ allowEmptyValues: true });

const sendMail = (subject, message) => {
  const mg = mailgun({
    apiKey: process.env.MAILGUN_API_KEY,
    domain: process.env.MAILGUN_DOMAIN
  });
  const dataSend = {
    from: process.env.EMAIL_FROM,
    to: process.env.EMAIL_TO,
    subject: subject,
    text: message
  };
  return mg.messages().send(dataSend, function (error, body) {
    if (error) {
      console.error(error)
    } else {
      console.log("Sent")
    }
  });
}

const main = () => {
  return request.get('https://www.tokopedia.com/emas/api/gold/price/history?format=month&limit=12')
    .type('json')
    .then((res) => res.body)
    .then((res) => {
      const data = res.data;
      const newPrice = data[0];
      const latestDay = data.slice(0, 2);
      const getLower = (prices, key) =>  prices.reduce((prev, curr) => prev[key] < curr[key] ? prev : curr);
      const getLowerBuyPrice = getLower(latestDay, 'buy_price');
      
      if (!db.has('latest_price') || !db.has('lower_last_price')) {
        db.set('latest_price', newPrice);
        db.set('lower_last_price', getLowerBuyPrice);
        db.set('prices', res.data);
        return;
      }
      
      const lowerLastPrice = db.get('lower_last_price');
      
      db.set('latest_price', newPrice);
      db.set('last_updated', new Date());

      if (newPrice.buy_price < lowerLastPrice.buy_price) {
        // send notification
        db.set('lower_last_price', newPrice);
        const priceIDR1 = lowerLastPrice.buy_price.toLocaleString('id', { style: 'currency', currency: 'IDR' });
        const priceIDR2 = newPrice.buy_price.toLocaleString('id', { style: 'currency', currency: 'IDR' });
        let bodyMail = fs.readFileSync('./template.txt', 'utf-8');

        bodyMail = bodyMail
          .replace('$priceIDR1', priceIDR1)
          .replace('$priceIDR2', priceIDR2)
          .replace('$beforeDate', lowerLastPrice.date_price)
          .replace('$newDate', newPrice.date_price);

        return sendMail('Update Harga Emas Tokopedia', bodyMail);        
      }

    });
}

(function() {
  console.log('Service Started!');
  setInterval(main, (1000 * 60 * 60) * 24)
})();

import nacl from 'tweetnacl';
import fs from 'fs';

export default function generateKeys(){
  const seed = nacl.randomBytes(32);
  const { 
    publicKey, 
    secretKey, 
  } = nacl.sign.keyPair.fromSeed(seed);

  const keyObj = {
    publicKey: Buffer.from(publicKey, 'base64').toString('hex'),
    signingKey: Buffer.from(secretKey.slice(0, 32), 'base64').toString('hex'),
    secretKey: secretKey.toString(),
    secretKeyHex: Buffer.from(secretKey, 'base64').toString('hex'),
    anchorageApiKey: 'REPLACE_WITH_API_KEY',
  };

  fs.writeFile('keys.json', JSON.stringify(keyObj), {},  (err) => {
    if (err) {
      console.log('There was an error creating your keys file');
      console.log(err.message);
    }

    console.log('Keys were successfully created in keys.json, don\'t forget to add your API Key per documentation');
  });
};

generateKeys();

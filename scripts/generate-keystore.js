import forge from 'node-forge';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const KEYSTORE_PATH = path.join(__dirname, '../android/app/release.keystore');
const PASSWORD = 'friends_enterprise_secret';
const ALIAS = 'release';

function generateKeystore() {
  if (fs.existsSync(KEYSTORE_PATH)) {
    console.log('Keystore already exists at:', KEYSTORE_PATH);
    return;
  }

  console.log('Generating new release keystore...');

  const keys = forge.pki.rsa.generateKeyPair(2048);
  const cert = forge.pki.createCertificate();
  cert.publicKey = keys.publicKey;
  cert.serialNumber = '01';
  cert.validity.notBefore = new Date();
  cert.validity.notAfter = new Date();
  cert.validity.notAfter.setFullYear(cert.validity.notBefore.getFullYear() + 25);

  const attrs = [
    { name: 'commonName', value: 'Friends Enterprise' },
    { name: 'countryName', value: 'BD' },
    { name: 'organizationName', value: 'Friends Enterprise' },
    { shortName: 'OU', value: 'Production' }
  ];
  cert.setSubject(attrs);
  cert.setIssuer(attrs);
  cert.sign(keys.privateKey, forge.md.sha256.create());

  const p12Asn1 = forge.pkcs12.toPkcs12Asn1(
    keys.privateKey,
    [cert],
    PASSWORD,
    { friendlyName: ALIAS, algorithm: 'aes256' }
  );
  
  const p12Der = forge.asn1.toDer(p12Asn1).getBytes();
  const p12Buffer = Buffer.from(p12Der, 'binary');

  const dir = path.dirname(KEYSTORE_PATH);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  fs.writeFileSync(KEYSTORE_PATH, p12Buffer);
  console.log('Successfully generated release keystore at:', KEYSTORE_PATH);
}

try {
  generateKeystore();
} catch (error) {
  console.error('Failed to generate keystore:', error);
  process.exit(1);
}

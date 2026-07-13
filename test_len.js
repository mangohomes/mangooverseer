const fs = require('fs');
const env = fs.readFileSync('.env.local', 'utf8');
const match = env.match(/FIREBASE_PRIVATE_KEY="(.*)"/);
if (match) {
  console.log("Local length:", match[1].length);
  // Also print length if we replace \\n with nothing
  console.log("Without escaped slashes:", match[1].replace(/\\n/g, '\n').length);
}

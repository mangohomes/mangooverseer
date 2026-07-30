import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const systemInstruction = "Hello world";
const contents = [{ role: "user", parts: [{ text: "Hello" }] }];

const apiKey = process.env.GEMINI_API_KEY;
console.log("API Key found:", !!apiKey);

const fetchRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    systemInstruction: { parts: [{ text: systemInstruction }] },
    contents
  })
});

console.log("Status:", fetchRes.status);
const data = await fetchRes.json();
console.log(JSON.stringify(data, null, 2));

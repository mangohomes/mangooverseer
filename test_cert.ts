import { cert } from 'firebase-admin/app';

let pk = `-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQDAp9zDEdVojrOq\nAbi2oE14U0lWueM0+1E64PKeEX9mC3hMH5YkYJqBHCD1bOkd4M2S0nNbIM9TWS64\ncTzbM94T77Xxb/0q60WLR0l1lDCnw7gIOCAjc0n68h47wwNMJDnA3oEYLoxygwEl\nlHhX8u+mBaCF3Hk0upV+czfDXxJJ2AmZAsrTFUX/1zZ4iF9oyLI+tJT9W8mhsHKT\nHA00OO/MY1NEvS0REuDKB2z3armyqyFXfaxY8mvAcm8sRcnyxRQukh2pI6ouW+GT\nuV4oWPWzYoTi87ZnMyfDjn21tldX6k+GBV6oJ1oTxf2BgErE43/3+6lWtcvyDWxK\n4A6Z7zIXAgMBAAECggEACJAfxA8AgaZth3lp+LpZcEvFGqc4WUwnNKH3rrnXvKSxtfqWPX5J66C5\nUBg19zH7a71/X82h9hoRPRZGtMjOltyuygJRu+HcnJS0cnfaSeBWDNe05HHO+xMK\ngi+To4XRv0UDFpv9YQT+CaWCFsGYFEpSnUGGPLUnWXtN1xTzYgzX1FKdKR/9pe+a\nC4GQJHclwXZHG1LyI+oh2NBT9JhEpqhK2McYOkRlmKNoAy8E57BH3UJGiG1+A6g3\n3tplkWc2l/baIkpngnCtVtRUpspXVb27rxaXXEUHFQKBgQD1hSP5SPk6aw36x+T3\n6Y1okkZ5PlRiC48Z6yAUr9Ljg3iJb4P7SVnXhHD0xRm5eTkUEb3tcRh7OBQTkg1D\n9TZ6/I1p3taGOWkBrA5bjoP4WAViSOVysZrFtlCqxu+r4P1Q2qZH4ieWkTCOigyR\n6rFK50/h3UE+TgPlbLnK/S1howKBgQDI4Q9DqsMdPo4n+xG5lHRQMJwoZA2G68aO\n0tJjwMWivjXE6KuimR47lVwvXRV0Sbt5cSXhCjN5WJNW74UsiwOMk4Knd9ivXcfS\n2Rc2vA1I/zLEoIGSuVbPggIgAg1FWVavff5V5ebBNAbDjhaWvE/LG5XI5SH7QaBO\nB1ybKDa8/QKBgQCi/U8jZ6lkebtfF6LOXbKtkCXOyW0VZZ0LVMcIVKzIsverLWfN\nwyUsaNTf+ZUZRvt4ckrGvUTGUDUrxNKfocMYJF7wwKljk+s82+7wIw1DKZPxanlA\nCd24kU6+ALENRqCEM5Mdt2oWj65Pgh/UIpyuIB8sz0hHx1zYyrQQqMCexwKBgGP4\nFSegyN857XcaLLUFm2j4+A3l1RGLLtKPOqLoIbMfJBUtkZUmzHPsneb4VR/9Pa5v\nT+GRuRIvsYu3QbhsKkUAeCotq4mCi1p0LWhQ5++nCTXvhuxlDj3Qvov9WWtkzY4i\njrti4ZbO9HrHsJgteSxkOwOyfFnVTBjo8v5IYg1lAoGAVmWDQhMXxyrZhqnRGX3f\n-----END PRIVATE KEY-----\n`;

try {
  if (pk.startsWith('"') && pk.endsWith('"')) {
    pk = pk.substring(1, pk.length - 1);
  }
  pk = pk.replace(/-----BEGIN PRIVATE KEY-----/g, '')
         .replace(/-----END PRIVATE KEY-----/g, '')
         .replace(/\\n/g, '')
         .replace(/\n/g, '')
         .replace(/\r/g, '')
         .replace(/\s+/g, '');

  const chunks = pk.match(/.{1,64}/g) || [];
  pk = `-----BEGIN PRIVATE KEY-----\n${chunks.join('\n')}\n-----END PRIVATE KEY-----\n`;

  cert({
    projectId: 'testttt-bf167',
    clientEmail: 'firebase-adminsdk-fbsvc@testttt-bf167.iam.gserviceaccount.com',
    privateKey: pk,
  });
  console.log("SUCCESS");
} catch (e) {
  console.error("FAIL", e);
}

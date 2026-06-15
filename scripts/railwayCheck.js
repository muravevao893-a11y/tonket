const required = ['DATABASE_URL', 'PUBLIC_APP_URL'];
const recommended = ['APP_SECRET', 'TELEGRAM_BOT_TOKEN', 'PLATFORM_TON_ADDRESS', 'PLATFORM_ADMIN_TON_ADDRESS'];

console.log('TONKET Railway config check');
for (const key of required) {
  console.log(`${process.env[key] ? '✅' : '❌'} ${key}`);
}
for (const key of recommended) {
  console.log(`${process.env[key] ? '✅' : '⚠️ '} ${key}`);
}
console.log('PORT:', process.env.PORT || '(Railway will inject it at runtime)');

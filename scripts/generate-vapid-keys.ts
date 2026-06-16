/**
 * Генерация VAPID-ключей для Web Push.
 *
 * Запуск: npx tsx scripts/generate-vapid-keys.ts
 *
 * Скопируйте вывод в .env:
 *   VAPID_PUBLIC_KEY=...
 *   VAPID_PRIVATE_KEY=...
 *   VAPID_SUBJECT=mailto:admin@example.com
 */
import webpush from "web-push";

const keys = webpush.generateVAPIDKeys();

console.log("VAPID keys (add to .env):\n");
console.log(`VAPID_PUBLIC_KEY=${keys.publicKey}`);
console.log(`VAPID_PRIVATE_KEY=${keys.privateKey}`);
console.log("VAPID_SUBJECT=mailto:admin@example.com");

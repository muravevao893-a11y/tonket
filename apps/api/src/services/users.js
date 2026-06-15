export async function upsertTelegramUser(client, input) {
  const result = await client.query(
    `
    INSERT INTO app_users (
      telegram_id, username, first_name, last_name, language_code, photo_url, is_premium, last_seen_at, metadata
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, now(), jsonb_build_object('telegram_raw', $8::jsonb))
    ON CONFLICT (telegram_id) DO UPDATE SET
      username = EXCLUDED.username,
      first_name = EXCLUDED.first_name,
      last_name = EXCLUDED.last_name,
      language_code = EXCLUDED.language_code,
      photo_url = COALESCE(EXCLUDED.photo_url, app_users.photo_url),
      is_premium = EXCLUDED.is_premium,
      last_seen_at = now(),
      updated_at = now(),
      metadata = app_users.metadata || jsonb_build_object('telegram_raw', $8::jsonb)
    RETURNING *
    `,
    [
      input.telegramId,
      input.username,
      input.firstName,
      input.lastName,
      input.languageCode,
      input.photoUrl,
      input.isPremium,
      JSON.stringify(input.raw || {}),
    ],
  );
  return result.rows[0];
}

export function publicUser(row, wallet = null) {
  return {
    id: row.id,
    telegramId: row.telegram_id,
    username: row.username,
    firstName: row.first_name,
    lastName: row.last_name,
    languageCode: row.language_code,
    photoUrl: row.photo_url,
    isPremium: row.is_premium,
    role: row.role,
    wallet,
    createdAt: row.created_at,
    lastSeenAt: row.last_seen_at,
  };
}

/**
 * PM2 ecosystem config — UGC KOC jobs
 *
 * Desplegar:
 *   pm2 start ~/ugc-koc/scripts/ugc_pm2.config.js
 *   pm2 save
 */
module.exports = {
  apps: [
    {
      // Actualiza stats (views/likes/comments/shares) cada 90 minutos
      name: "ugc-stats-refresh",
      script: "python3",
      args: "/home/marketing-digital/ugc-koc/scripts/ugc_stats_refresh.py",
      cron_restart: "0 */2 * * *",   // cada 2h (cron no tiene resolución de 90min exactos)
      autorestart: false,             // no reiniciar si termina normalmente
      watch: false,
      log_file: "/home/marketing-digital/ugc-koc/scripts/ugc_stats.log",
      time: true,
      env: {
        PYTHONUNBUFFERED: "1",
      },
    },
  ],
};

// Tanggal "terakhir diperbarui" otomatis: dievaluasi saat build,
// jadi setiap deploy ulang tanggalnya selalu mencerminkan kapan web terakhir diperbarui.
export const UPDATED_AT: string = new Intl.DateTimeFormat("id-ID", {
  timeZone: "Asia/Jakarta",
  day: "numeric",
  month: "long",
  year: "numeric",
}).format(new Date());

// Must be imported BEFORE @sparticuz/chromium to ensure
// it detects the AL2023 runtime and extracts libnss3.so
if (process.env.VERCEL && !process.env.AWS_EXECUTION_ENV) {
  process.env.AWS_EXECUTION_ENV = 'AWS_Lambda_nodejs20.x';
}

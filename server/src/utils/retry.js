export async function withRetry(fn, retries = 3, delayMs = 1000) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      const is503 = error.message?.includes('503') || error.message?.includes('Service Unavailable');
      const isLastAttempt = attempt === retries;

      if (is503 && !isLastAttempt) {
        const wait = delayMs * 2 ** (attempt - 1); // 1s → 2s → 4s
        console.warn(`Gemini 503 on attempt ${attempt}. Retrying in ${wait}ms...`);
        await new Promise(res => setTimeout(res, wait));
      } else {
        throw error;
      }
    }
  }
}
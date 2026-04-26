
export async function withRetry(fn, retriesOrOpts = 3, delayMsArg = 1000) {
  const retries = typeof retriesOrOpts === 'object' ? (retriesOrOpts.retries  ?? 3)    : retriesOrOpts;
  const delayMs = typeof retriesOrOpts === 'object' ? (retriesOrOpts.delayMs  ?? 1000) : delayMsArg;

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      const is503 = error.message?.includes('503') || error.message?.includes('Service Unavailable');
      const isLastAttempt = attempt === retries;

      if (is503 && !isLastAttempt) {
        const wait = delayMs * 2 ** (attempt - 1);
        console.warn(`[withRetry] Gemini 503 on attempt ${attempt}/${retries}. Retrying in ${wait}ms...`);
        await new Promise(res => setTimeout(res, wait));
      } else {
        throw error; 
      }
    }
  }
}
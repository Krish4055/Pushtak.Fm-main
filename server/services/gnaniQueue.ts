/**
 * Global Gnani AI Request Queue (Mutex)
 * 
 * Gnani AI strictly enforces:
 * "Only 1 active request is allowed at a time. Wait for your current request to finish before sending another."
 * 
 * This queue ensures all outbound requests (TTS chunks, STT, diagnostics) are strictly serialized
 * with a mandatory safety cooldown between consecutive calls.
 */

type Task<T> = () => Promise<T>;

class GnaniQueue {
  private queue: Promise<any> = Promise.resolve();
  private safetyDelayMs = 200;

  /**
   * Enqueue a task to be executed strictly after all previous Gnani tasks have completed
   */
  public enqueue<T>(task: Task<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      this.queue = this.queue
        .then(async () => {
          try {
            const result = await task();
            await new Promise((r) => setTimeout(r, this.safetyDelayMs));
            resolve(result);
          } catch (err) {
            await new Promise((r) => setTimeout(r, this.safetyDelayMs));
            reject(err);
          }
        })
        .catch(async () => {
          // In case of an unhandled prior chain error, still process the task
          try {
            const result = await task();
            await new Promise((r) => setTimeout(r, this.safetyDelayMs));
            resolve(result);
          } catch (err) {
            await new Promise((r) => setTimeout(r, this.safetyDelayMs));
            reject(err);
          }
        });
    });
  }
}

export const gnaniQueue = new GnaniQueue();

// In-memory cache for static voice previews (sample sentences)
// Avoids ever calling Gnani TTS repeatedly for previewing voices
export const voicePreviewCache = new Map<string, Buffer>();


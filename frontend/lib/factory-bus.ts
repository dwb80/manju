type FactoryEvent = string;
type FactoryHandler<T = unknown> = (payload: T) => void;
const CHANNEL_NAME = "manju:factory-events:v1";

class FactoryBus {
  private handlers = new Map<FactoryEvent, Set<FactoryHandler>>();
  private channel: BroadcastChannel | null = null;

  constructor() {
    if (typeof window !== "undefined" && "BroadcastChannel" in window) {
      this.channel = new BroadcastChannel(CHANNEL_NAME);
      this.channel.onmessage = (event) => this.dispatch(event.data?.type, event.data?.payload);
    }
  }

  on<T = unknown>(type: FactoryEvent, handler: FactoryHandler<T>): () => void {
    const set = this.handlers.get(type) ?? new Set<FactoryHandler>();
    set.add(handler as FactoryHandler); this.handlers.set(type, set);
    return () => { set.delete(handler as FactoryHandler); if (!set.size) this.handlers.delete(type); };
  }

  emit<T = unknown>(type: FactoryEvent, payload: T): void {
    this.dispatch(type, payload);
    this.channel?.postMessage({ type, payload });
  }

  private dispatch(type: unknown, payload: unknown): void {
    if (typeof type !== "string") return;
    for (const handler of this.handlers.get(type) ?? []) handler(payload);
  }
}

let singleton: FactoryBus | null = null;
export function getFactoryBus(): FactoryBus { singleton ??= new FactoryBus(); return singleton; }

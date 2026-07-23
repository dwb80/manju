export interface Command {
  readonly commandId: string;
  readonly type: string;
  readonly issuedAt: string;
}

export interface CommandHandler<TCommand extends Command, TResult = void> {
  execute(command: TCommand): Promise<TResult>;
}

import logger from '@utils/Logger';

// eslint-disable-next-line import/no-cycle
import {
  StartTheGameCallback, FinishTheGameCallback, getDefaultAdditionalSessionInfo, PersistActionsContainer,
} from './utils';
import { ActionsLayout } from './ActionsLayout';

export abstract class AbstractUI {
  public abstract sendToUser(message: string, cleanAcions?: boolean): Promise<void>;

  public abstract interactWithUser<T extends string>(
    actions: ActionsLayout<T>, validate?: (action: T) => boolean,
  ): Promise<T>;

  public abstract showPersistentActions<T extends string>(
    message: string, actions: ActionsLayout<T>, actionsListener: (action: T) => void,
  ): Promise<PersistActionsContainer<T>>;

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  public init(runOnStart: StartTheGameCallback, runOnFinish: FinishTheGameCallback): this {
    logger.catchAndLogError('AbstractUI::init', runOnStart('1', this, getDefaultAdditionalSessionInfo()));
    return this;
  }

  public closeSession(): Promise<void> { return Promise.resolve(); }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  public onExit(..._args: any[]): Promise<void> { return Promise.resolve(); }
}

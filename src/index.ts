import { Player } from '@actors/Player';
import { DBService } from '@db/DBService';
import { InteractionModel } from '@db/entities';
import { Cursor } from '@db/Cursor';
import { AbstractInteraction } from '@interactions/AbstractInteraction';
import { SimpleInteraction } from '@interactions/SimpleInteraction';
import { buildZeroLocation } from '@scenarios';
import {
  AbstractUI, AbstractSessionUI,
  AdditionalSessionInfo,
  NodeUI, TelegramBotUi, ActionsLayout,
} from '@ui';
import { TelegramBotInlineUi } from '@ui/TelegramBotInlineUI';
import { DropSessionError } from '@utils/Error/DropSessionError';
import { getConfig } from 'ConfigProvider';
import { IntroScenario } from '@scenarios/IntroScenario';
import { DemoBaseScenario } from '@scenarios/DemoBaseScenario';
import { DemoBattleScenario } from '@scenarios/DemoBattleScenario';
import { AbstractScenario } from '@scenarios/AbstractScenario';
import { DemoMerchantScenario } from '@scenarios/DemoMerchantScenario';
import { ScenarioNo5 } from '@scenarios/Scenario5/index';

import { SessionState } from './SessionState';

class App {
  private ui: AbstractUI | AbstractSessionUI;

  private sessionStateMap: Map<string, SessionState> = new Map<string, SessionState>();

  private dbService = new DBService();

  private async treeTraversal(state: SessionState): Promise<void> {
    try {
      const nextInteractions: AbstractInteraction | null = await state.currentInteraction.interact();
      if (nextInteractions == null || state.status === 'DEAD') return;

      // eslint-disable-next-line no-param-reassign
      state.currentInteraction = nextInteractions;
      setTimeout(this.treeTraversal, 16, state);
    } catch (error) {
      if (error instanceof DropSessionError) return;
      console.log(error);
      await state.ui.sendToUser('Извините, что-то поломалось.\nЕсли вы не входите в команду разработки, напишите пожалуйста автору.\nСпасибо за понимание ;-)\n');
    }
  }

  private async closeSession(sessionId: string, ui: AbstractSessionUI | AbstractUI) {
    const state = this.sessionStateMap.get(sessionId);
    if (state == null) return;

    await ui.closeSession(sessionId);
    state.status = 'DEAD';
    await Promise.all(state.persistActionsContainers.map((container) => container.delete()));
    this.sessionStateMap.delete(sessionId);
  }

  private async _runSession(
    sessionId: string,
    ui: AbstractUI,
    additionalInfo: AdditionalSessionInfo,
  ): Promise<void> {
    try {
      if (this.sessionStateMap.get(sessionId) != null) {
        await ui.sendToUser('У тебя уже начата игровая сессия. Если хочешь начать с начала нажми на кнопку "Finish", а затем "Start" в закрепленном сообщении');
        return;
      }
      const state: SessionState = {
        sessionId,
        additionalInfo,
        player: new Player(),
        currentInteraction: new SimpleInteraction({ ui, message: 'Hi\n' }),
        finishSession: this.closeSession.bind(null, sessionId, ui),
        status: 'ALIVE',
        ui,
        persistActionsContainers: [],
        events: { 1: 0 },
        merchants: {},
        npcList: {},
      };
      this.sessionStateMap.set(sessionId, state);

      const zeroLocation = buildZeroLocation(ui, state);
      state.currentInteraction = zeroLocation;

      await this.treeTraversal(state);
    } catch (error) {
      console.error(error);
    }
  }

  private async runSession(
    sessionId: string,
    ui: AbstractUI,
    additionalInfo: AdditionalSessionInfo,
  ): Promise<void> {
    try {
      if (this.sessionStateMap.get(sessionId) != null) {
        await ui.sendToUser('У тебя уже начата игровая сессия. Если хочешь начать с начала нажми на кнопку "Finish", а затем "Start" в закрепленном сообщении');
        return;
      }
      const state: SessionState = {
        sessionId,
        additionalInfo,
        player: new Player(),
        currentInteraction: new SimpleInteraction({ ui, message: 'Hi\n' }),
        finishSession: this.closeSession.bind(null, sessionId, ui),
        status: 'ALIVE',
        ui,
        persistActionsContainers: [],
        events: { 1: 0 },
        merchants: {},
        npcList: {},
      };
      this.sessionStateMap.set(sessionId, state);

      const scenarioMap = new Map<number, AbstractScenario>();

      const cursor = new Cursor(this.dbService);

      const onChangeScenario = async (scenarioId: number) => {
        const nextScenario = scenarioMap.get(scenarioId);
        if (nextScenario != null) {
          nextScenario.run();
        } else if (scenarioId === 900) {
          const newScenario = new DemoBaseScenario(cursor, state, { onChangeScenario, onExit: state.finishSession });
          scenarioMap.set(newScenario.scenarioId, newScenario);
          await newScenario.init();
          newScenario.run();
        } else if (scenarioId === 901) {
          const newScenario = new DemoBattleScenario(cursor, state, { onChangeScenario, onExit: state.finishSession });
          scenarioMap.set(newScenario.scenarioId, newScenario);
          await newScenario.init();
          newScenario.run();
        } else if (scenarioId === 902) {
          const newScenario = new DemoMerchantScenario(
            cursor, state, { onChangeScenario, onExit: state.finishSession },
          );
          scenarioMap.set(newScenario.scenarioId, newScenario);
          await newScenario.init();
          newScenario.run();
        } else if (scenarioId === 5) {
          const newScenario = new ScenarioNo5(
            cursor, state, { onChangeScenario, onExit: state.finishSession },
          );
          scenarioMap.set(newScenario.scenarioId, newScenario);
          await newScenario.init();
          newScenario.run();
        }
      };

      const introScenario = new IntroScenario(cursor, state, { onChangeScenario, onExit: state.finishSession });
      scenarioMap.set(introScenario.scenarioId, introScenario);

      await introScenario.init();
      introScenario.run();
    } catch (error) {
      console.error(error);
    }
  }

  private onExit(event: string | number) {
    void this.ui.onExit(Array.from(this.sessionStateMap.keys()), event.toString());
    void this.dbService.destructor();
  }

  constructor(type: 'NODE' | 'TELEGRAM' | 'TELEGRAM_INLINE') {
    process.once('SIGINT', this.onExit.bind(this, 'SIGINT'));
    process.once('SIGTERM', this.onExit.bind(this, 'SIGTERM'));
    // process.once('beforeExit', this.onExit.bind(this));

    this.runSession = this.runSession.bind(this);
    this.closeSession = this.closeSession.bind(this);
    this.treeTraversal = this.treeTraversal.bind(this);

    if (type === 'TELEGRAM') this.ui = new TelegramBotUi();
    else if (type === 'TELEGRAM_INLINE') this.ui = new TelegramBotInlineUi();
    else this.ui = new NodeUI();
  }

  public init() {
    this.ui.init(this.runSession, this.closeSession);
  }
}

const config = getConfig();
const app = new App(config.MAIN_UI);
app.init();

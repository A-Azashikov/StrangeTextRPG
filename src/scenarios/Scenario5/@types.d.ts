import { Player } from '@actors/Player';
import { AbstractItem } from '@actors/AbstractItem';
import { AdditionalSessionInfo } from '@ui';
import { ScenarioEvent } from '@utils/@types/ScenarioEvent';

export interface MerchantProduct {
  internalName: string;
  displayName: string;
  price: number;
  item: AbstractItem;
}

export interface ScenarioContext {
  additionalInfo: AdditionalSessionInfo;
  player: Player;
  events: Record<number, ScenarioEvent>;
  battles: Record<string, number>;
  loadMerchantGoods: (merchantId: number) => void;
  currentMerchant: {
    goods: MerchantProduct[];
  };
}

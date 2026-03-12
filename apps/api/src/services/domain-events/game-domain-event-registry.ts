import type { AppServices } from '../../types/api.js'
import { STATION_BUILDING_UPGRADE_FINALIZE_EVENT_TYPE } from '../station.service.js'
import {
  STATION_MINING_COMPLETED_EVENT_TYPE,
  STATION_MINING_RIG_ARRIVED_EVENT_TYPE,
  STATION_MINING_RIG_RETURNED_EVENT_TYPE,
} from '../mining.service.js'
import type { DomainEventHandlerRegistry } from './types.js'
import { stationBuildingUpgradeFinalizeEventHandler } from './handlers/station-building-upgrade-finalize.handler.js'
import { stationMiningRigArrivedEventHandler } from './handlers/station-mining-rig-arrived.handler.js'
import { stationMiningCompletedEventHandler } from './handlers/station-mining-completed.handler.js'
import { stationMiningRigReturnedEventHandler } from './handlers/station-mining-rig-returned.handler.js'

export function buildGameDomainEventHandlerRegistry(): DomainEventHandlerRegistry<AppServices> {
  return {
    [STATION_BUILDING_UPGRADE_FINALIZE_EVENT_TYPE]: stationBuildingUpgradeFinalizeEventHandler,
    [STATION_MINING_RIG_ARRIVED_EVENT_TYPE]: stationMiningRigArrivedEventHandler,
    [STATION_MINING_COMPLETED_EVENT_TYPE]: stationMiningCompletedEventHandler,
    [STATION_MINING_RIG_RETURNED_EVENT_TYPE]: stationMiningRigReturnedEventHandler,
  }
}

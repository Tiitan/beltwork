export type DomainEventHandlerInput<TPayload, TServices = unknown> = {
  tx: any
  services: TServices
  eventId: string
  stationId: string
  now: Date
  payload: TPayload
}

export type DomainEventHandlerDefinition<TPayload = unknown, TServices = unknown> = {
  requiresStationLock: boolean
  parsePayload: (payloadJson: unknown) => TPayload | null
  handle: (input: DomainEventHandlerInput<TPayload, TServices>) => Promise<void>
}

export type DomainEventHandlerRegistry<TServices = unknown> = Record<
  string,
  DomainEventHandlerDefinition<any, TServices>
>

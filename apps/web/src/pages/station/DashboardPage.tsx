import { useStation } from '../../features/station/useStation'
import {
  stationListRowClassName,
  stationSectionTitleClassName,
  stationSectionWrapperClassName,
} from './styles'

export function DashboardPage() {
  const { inventory } = useStation()

  return (
    <div className="grid gap-3 md:grid-cols-2">
      <section aria-label="Station summary" className={stationSectionWrapperClassName}>
        <h2 className={stationSectionTitleClassName}>Summary</h2>
        <p>Station id: st-0001</p>
        <p>Coordinates: x 140, y -25</p>
        <p>Status: operational</p>
      </section>

      <section aria-label="Inventory" className={stationSectionWrapperClassName}>
        <h2 className={stationSectionTitleClassName}>Inventory</h2>
        <ul className="m-0 grid list-none gap-2 p-0">
          {inventory.map((item) => (
            <li key={item.resourceKey} className={stationListRowClassName}>
              <span className="min-w-0 break-words">{item.resourceKey}</span>
              <strong>{item.amount}</strong>
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}

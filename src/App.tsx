import { useState } from 'react'
import TabBar from './components/TabBar'
import TabPane from './components/TabPane'
import ImagesTab from './features/images/ImagesTab'
import ItemsTab from './features/items/ItemsTab'
import MarketTab from './features/market/MarketTab'
import PromoTab from './features/promo/PromoTab'
import ReportTab from './features/report/ReportTab'
import { ShopProvider } from './store/ShopContext'
import type { Tab } from './types'

export default function App() {
  const [tab, setTab] = useState<Tab>('items')
  return (
    <ShopProvider>
      <main>
        <header className="top">
          <h1>Vend Shop Tracker</h1>
          <TabBar tab={tab} onChange={setTab} />
        </header>
        <p className="sub">Keep every item's cost (modal), sell price and stock in one place. Prices are in World Locks (WL). 100 WL = 1 DL.</p>

        <TabPane active={tab === 'items'}><ItemsTab /></TabPane>
        <TabPane active={tab === 'report'}><ReportTab /></TabPane>
        <TabPane active={tab === 'promo'}><PromoTab /></TabPane>
        <TabPane active={tab === 'market'}><MarketTab /></TabPane>
        <TabPane active={tab === 'images'}><ImagesTab /></TabPane>
      </main>
    </ShopProvider>
  )
}

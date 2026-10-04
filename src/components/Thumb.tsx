/** Small picture box (display only). */
import { useShop } from '../store/ShopContext'

export default function Thumb({ name }: { name: string }) {
  const { images } = useShop()
  const url = images.urlFor(name)
  return <span className="thumb">{url ? <img src={url} alt="" draggable={false} /> : <span aria-hidden="true">?</span>}</span>
}

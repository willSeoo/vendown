import Thumb from '../../components/Thumb'
import { useConfirm } from '../../hooks/useConfirm'
import { useShop } from '../../store/ShopContext'

export default function ImagesTab() {
  const { items, market, images } = useShop()
  const { imgs, builtin, imgMsg, uploadMany, delImage, hasImg } = images
  const { armed, ask } = useConfirm()
  const names = Array.from(new Set([...items.map((i) => i.name), ...market.map((m) => m.name)]))

  return (
    <>
      <section className="panel">
        <h2>Item images</h2>
        <p className="sub">Pick many images at once. The file name must match the item name, for example "Climbing Vine.png" (not case sensitive). Every image is shared by Items and Market. Some images come built in with the app; an image you upload replaces the built-in one for that item.</p>
        <input type="file" accept="image/*" multiple onChange={(e) => { if (e.target.files) uploadMany(e.target.files); e.target.value = '' }} aria-label="Upload images" />
        {imgMsg && <p className="sub" role="status">{imgMsg}</p>}
      </section>
      {names.filter((n) => !hasImg(n)).length > 0 && (
        <section className="panel">
          <h2>Items without image<small>upload a file with the same name</small></h2>
          <div className="igrid">
            {names.filter((n) => !hasImg(n)).map((n) => <div className="icell" key={n}><Thumb name={n} /><span>{n}</span></div>)}
          </div>
        </section>
      )}
      <section className="panel">
        <h2>Library<small>{Object.keys({ ...builtin, ...imgs }).length} images</small></h2>
        {Object.keys({ ...builtin, ...imgs }).length === 0 && <p className="sub">No images yet.</p>}
        <div className="igrid">
          {Object.entries({ ...builtin, ...imgs }).sort((a, b) => a[1].name.localeCompare(b[1].name)).map(([k, v]) => (
            <div className="icell" key={k}>
              <Thumb name={v.name} /><span>{v.name}</span>
              {imgs[k]
                ? <button className="sm del" onClick={() => ask(`i${k}`, () => delImage(k))}>{armed === `i${k}` ? 'Confirm' : builtin[k] ? 'Reset to built-in' : 'Delete'}</button>
                : <small>built-in</small>}
            </div>
          ))}
        </div>
      </section>
    </>
  )
}

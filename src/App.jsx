import { useEffect, useMemo, useRef, useState } from 'react'
import { APPROVED_IMAGES } from './approved-images.js'
import { LOOKUPS, SEED_RECIPES, lookupName } from './data.js'

const STORAGE = {
  recipes: 'savor.customRecipes.v1',
  plan: 'savor.mealPlan.v1',
  checked: 'savor.shoppingChecked.v1',
  pantry: 'savor.pantry.v1',
}

const MEAL_SLOTS = ['Breakfast', 'Lunch', 'Dinner', 'Snack']
const SHOPPING_CATEGORIES = ['Produce', 'Meat & seafood', 'Dairy & eggs', 'Grains & pantry', 'Oils & condiments', 'Canned & jarred', 'Spices']

const ICON_PATHS = {
  recipes: '<path d="M4 3h5a3 3 0 0 1 3 3v15a3 3 0 0 0-3-3H4z"/><path d="M20 3h-5a3 3 0 0 0-3 3v15a3 3 0 0 1 3-3h5z"/>',
  planner: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 11h18"/>',
  shopping: '<path d="M6 8h12l1 13H5L6 8Z"/><path d="M9 8a3 3 0 0 1 6 0"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>',
  flame: '<path d="M12 22c4.4 0 8-3.6 8-8 0-3-1.5-5.5-4-7-1 3-2 4-4 5 0-4-2-7-5-9 0 4-3 6-3 11 0 4.4 3.6 8 8 8Z"/>',
  chevronLeft: '<path d="m15 18-6-6 6-6"/>',
  chevronRight: '<path d="m9 18 6-6-6-6"/>',
  x: '<path d="M18 6 6 18M6 6l12 12"/>',
  check: '<path d="m5 12 4 4L19 6"/>',
  more: '<circle cx="5" cy="12" r="1" fill="currentColor"/><circle cx="12" cy="12" r="1" fill="currentColor"/><circle cx="19" cy="12" r="1" fill="currentColor"/>',
  arrowUp: '<path d="m18 15-6-6-6 6"/>',
  arrowDown: '<path d="m6 9 6 6 6-6"/>',
  trash: '<path d="M3 6h18M8 6V4h8v2M19 6l-1 15H6L5 6M10 11v5M14 11v5"/>',
  image: '<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="2"/><path d="m21 15-5-5L5 20"/>',
  sparkles: '<path d="m12 3 1.2 3.8L17 8l-3.8 1.2L12 13l-1.2-3.8L7 8l3.8-1.2L12 3ZM5 15l.7 2.3L8 18l-2.3.7L5 21l-.7-2.3L2 18l2.3-.7L5 15ZM19 14l.6 1.9 1.9.6-1.9.6L19 19l-.6-1.9-1.9-.6 1.9-.6L19 14Z"/>',
  leaf: '<path d="M11 20A7 7 0 0 1 4 13C4 6 13 3 20 4c1 7-2 16-9 16Z"/><path d="M4 21c4-7 8-10 14-14"/>',
  edit: '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4Z"/>',
  calendarPlus: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 11h18M12 14v4M10 16h4"/>',
}

function Icon({ name, size = 20, className = '' }) {
  return <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" dangerouslySetInnerHTML={{ __html: ICON_PATHS[name] }} />
}

function readStorage(key, fallback) {
  try {
    const value = localStorage.getItem(key)
    return value ? JSON.parse(value) : fallback
  } catch {
    return fallback
  }
}

function useStoredState(key, fallback) {
  const [value, setValue] = useState(() => readStorage(key, fallback))
  useEffect(() => localStorage.setItem(key, JSON.stringify(value)), [key, value])
  return [value, setValue]
}

function formatDateKey(date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function parseDateKey(value) {
  const [year, month, day] = value.split('-').map(Number)
  return new Date(year, month - 1, day)
}

function startOfWeek(date = new Date()) {
  const result = new Date(date)
  const day = result.getDay()
  result.setDate(result.getDate() - ((day + 6) % 7))
  result.setHours(0, 0, 0, 0)
  return result
}

function addDays(date, days) {
  const result = new Date(date)
  result.setDate(result.getDate() + days)
  return result
}

function formatWeekRange(start) {
  const end = addDays(start, 6)
  const sameMonth = start.getMonth() === end.getMonth()
  if (sameMonth) return `${start.toLocaleDateString('en-US', { month: 'long', day: 'numeric' })} – ${end.getDate()}, ${end.getFullYear()}`
  return `${start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – ${end.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`
}

function moveItem(items, index, direction) {
  const nextIndex = index + direction
  if (nextIndex < 0 || nextIndex >= items.length) return items
  const copy = [...items]
  ;[copy[index], copy[nextIndex]] = [copy[nextIndex], copy[index]]
  return copy
}

function getMealName(recipe) {
  return lookupName(LOOKUPS.mealTypes, recipe.mealTypeId, 'meal_type_id', 'meal_type_name')
}

function getCuisineName(recipe) {
  return lookupName(LOOKUPS.cuisines, recipe.cuisineId, 'cuisine_id', 'cuisine_name')
}

function initialRecipeForm(weekStart) {
  const dinnerDate = addDays(weekStart, 2)
  return {
    title: '', description: '', sourceUrl: '', cuisineId: 'CU07', mealTypeId: 'MT03', dietaryTagIds: [], categoryIds: [],
    servings: 4, prepTime: 15, cookTime: 30, spiceLevel: 1, accentColor: '#C65D42', coverImageUrl: '',
    includeInSuggestions: true, addImmediately: false, plannedWeek: formatDateKey(weekStart), plannedDate: formatDateKey(dinnerDate), plannedMeal: 'Dinner', plannedTime: '18:30',
    includeInShoppingList: true, showNutrition: false, allowSubstitutions: true, measurementSystem: 'us',
    ingredientSections: [{ id: crypto.randomUUID(), name: 'Main', items: [{ id: crypto.randomUUID(), ingredientId: 'ING012', ingredientName: 'Onion', quantity: '1', unit: 'piece', optional: false, notes: '' }] }],
    steps: [{ id: crypto.randomUUID(), instruction: '', timerMinutes: '' }],
  }
}

function RecipeCard({ recipe, onOpen, onPlan }) {
  const tags = recipe.dietaryTagIds.slice(0, 2).map((id) => lookupName(LOOKUPS.dietaryTags, id, 'dietary_tag_id', 'dietary_tag_name')).filter(Boolean)
  return (
    <article className="recipe-card" onClick={() => onOpen(recipe)}>
      <div className="recipe-card__image-wrap" style={{ '--accent': recipe.accentColor }}>
        <img src={recipe.coverImageUrl || APPROVED_IMAGES.placeholder} alt="" className="recipe-card__image" />
        <span className="meal-pill">{getMealName(recipe)}</span>
        <button className="image-action" onClick={(event) => { event.stopPropagation(); onPlan(recipe) }} aria-label={`Plan ${recipe.title}`}><Icon name="calendarPlus" size={18} /></button>
      </div>
      <div className="recipe-card__body">
        <p className="eyebrow">{getCuisineName(recipe)} · {recipe.categoryIds[0] ? lookupName(LOOKUPS.categories, recipe.categoryIds[0], 'category_id', 'category_name') : 'Homemade'}</p>
        <h3>{recipe.title}</h3>
        <p className="recipe-card__description">{recipe.description || 'A delicious addition to your recipe collection.'}</p>
        <div className="tag-row">{tags.map((tag) => <span className="soft-tag" key={tag}>{tag}</span>)}</div>
        <div className="recipe-card__meta">
          <span><Icon name="clock" size={16} /> {recipe.totalTime} min</span>
          <span><Icon name="users" size={16} /> {recipe.servings}</span>
          <span className="spice-dots" aria-label={`Spice level ${recipe.spiceLevel} of 5`}>{Array.from({ length: 5 }, (_, index) => <i key={index} className={index < recipe.spiceLevel ? 'active' : ''} />)}</span>
        </div>
      </div>
    </article>
  )
}

function Toggle({ checked, onChange, label, description }) {
  return (
    <label className="toggle-row">
      <span><strong>{label}</strong>{description && <small>{description}</small>}</span>
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />
      <i className="toggle" />
    </label>
  )
}

function RecipeOptions({ form, setField, open, setOpen }) {
  const ref = useRef(null)
  useEffect(() => {
    if (!open) return undefined
    const close = (event) => { if (!ref.current?.contains(event.target)) setOpen(false) }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [open, setOpen])

  return (
    <div className="options-wrap" ref={ref}>
      <button type="button" className={`btn btn--secondary ${open ? 'is-active' : ''}`} onClick={() => setOpen(!open)}><Icon name="more" size={18} /> Recipe options</button>
      {open && <div className="options-popover">
        <div className="options-popover__header"><div><p className="eyebrow">Preferences</p><h4>Recipe options</h4></div><button type="button" className="icon-btn" onClick={() => setOpen(false)}><Icon name="x" size={18} /></button></div>
        <Toggle checked={form.includeInShoppingList} onChange={(value) => setField('includeInShoppingList', value)} label="Add to shopping lists" description="Include ingredients when planned" />
        <Toggle checked={form.showNutrition} onChange={(value) => setField('showNutrition', value)} label="Show nutrition" description="Display nutrition details" />
        <Toggle checked={form.allowSubstitutions} onChange={(value) => setField('allowSubstitutions', value)} label="Allow substitutions" description="Suggest ingredient alternatives" />
        <div className="measurement-choice"><span><strong>Measurements</strong><small>Preferred recipe units</small></span><div className="segmented"><button type="button" className={form.measurementSystem === 'us' ? 'selected' : ''} onClick={() => setField('measurementSystem', 'us')}>US</button><button type="button" className={form.measurementSystem === 'metric' ? 'selected' : ''} onClick={() => setField('measurementSystem', 'metric')}>Metric</button></div></div>
      </div>}
    </div>
  )
}

function ChipPicker({ items, selected, onChange, idKey, nameKey }) {
  return <div className="chip-picker">{items.map((item) => {
    const id = item[idKey]
    const isSelected = selected.includes(id)
    return <button type="button" key={id} className={isSelected ? 'selected' : ''} onClick={() => onChange(isSelected ? selected.filter((value) => value !== id) : [...selected, id])}>{isSelected && <Icon name="check" size={14} />}{item[nameKey]}</button>
  })}</div>
}

function RecipeEditor({ weekStart, onClose, onSave }) {
  const [form, setForm] = useState(() => initialRecipeForm(weekStart))
  const [optionsOpen, setOptionsOpen] = useState(false)
  const [error, setError] = useState('')
  const setField = (field, value) => setForm((current) => ({ ...current, [field]: value }))

  const updateSection = (sectionId, transform) => setForm((current) => ({ ...current, ingredientSections: current.ingredientSections.map((section) => section.id === sectionId ? transform(section) : section) }))
  const addIngredient = (sectionId) => updateSection(sectionId, (section) => ({ ...section, items: [...section.items, { id: crypto.randomUUID(), ingredientId: '', ingredientName: '', quantity: '', unit: 'piece', optional: false, notes: '' }] }))
  const updateIngredient = (sectionId, itemId, field, value) => updateSection(sectionId, (section) => ({ ...section, items: section.items.map((item) => item.id === itemId ? { ...item, [field]: value } : item) }))
  const updateIngredientSearch = (sectionId, itemId, value) => {
    const match = LOOKUPS.ingredients.find((ingredient) => ingredient.ingredient_name.toLowerCase() === value.toLowerCase())
    updateSection(sectionId, (section) => ({ ...section, items: section.items.map((item) => item.id === itemId ? { ...item, ingredientName: value, ingredientId: match?.ingredient_id || '' } : item) }))
  }
  const removeIngredient = (sectionId, itemId) => updateSection(sectionId, (section) => ({ ...section, items: section.items.filter((item) => item.id !== itemId) }))
  const moveIngredient = (sectionId, index, direction) => updateSection(sectionId, (section) => ({ ...section, items: moveItem(section.items, index, direction) }))
  const addSection = () => setForm((current) => ({ ...current, ingredientSections: [...current.ingredientSections, { id: crypto.randomUUID(), name: `Section ${current.ingredientSections.length + 1}`, items: [{ id: crypto.randomUUID(), ingredientId: '', ingredientName: '', quantity: '', unit: 'piece', optional: false, notes: '' }] }] }))
  const removeSection = (sectionId) => setForm((current) => ({ ...current, ingredientSections: current.ingredientSections.filter((section) => section.id !== sectionId) }))
  const updateStep = (stepId, field, value) => setForm((current) => ({ ...current, steps: current.steps.map((step) => step.id === stepId ? { ...step, [field]: value } : step) }))
  const removeStep = (stepId) => setForm((current) => ({ ...current, steps: current.steps.filter((step) => step.id !== stepId) }))

  const submit = (event) => {
    event.preventDefault()
    const ingredients = form.ingredientSections.flatMap((section) => section.items.filter((item) => item.ingredientId).map((item) => ({ ...item, sectionName: section.name, ingredientName: lookupName(LOOKUPS.ingredients, item.ingredientId, 'ingredient_id', 'ingredient_name') })))
    if (!form.title.trim()) return setError('Add a title for your recipe.')
    if (!ingredients.length) return setError('Add at least one ingredient.')
    if (!form.steps.some((step) => step.instruction.trim())) return setError('Add at least one method step.')
    onSave({ ...form, id: `custom-${Date.now()}`, title: form.title.trim(), description: form.description.trim(), sourceName: 'My recipe', totalTime: Number(form.prepTime) + Number(form.cookTime), ingredients, steps: form.steps.filter((step) => step.instruction.trim()), isSeed: false })
  }

  return (
    <div className="editor-overlay">
      <form className="recipe-editor" onSubmit={submit}>
        <header className="editor-header"><div><button type="button" className="back-link" onClick={onClose}><Icon name="chevronLeft" size={18} /> Back to recipes</button><h1>Create a new recipe</h1><p>Add the details once, then enjoy easier planning all week.</p></div><div className="editor-actions"><RecipeOptions form={form} setField={setField} open={optionsOpen} setOpen={setOptionsOpen} /><button type="submit" className="btn btn--primary"><Icon name="check" size={18} /> Save recipe</button></div></header>
        {error && <div className="form-error">{error}</div>}
        <datalist id="ingredient-options">{LOOKUPS.ingredients.map((ingredient) => <option value={ingredient.ingredient_name} key={ingredient.ingredient_id} />)}</datalist>

        <div className="editor-grid">
          <div className="editor-main">
            <section className="form-section"><div className="section-heading"><span>01</span><div><h2>Recipe details</h2><p>The essentials people will see first.</p></div></div>
              <div className="field-grid">
                <label className="field field--wide"><span>Recipe title *</span><input value={form.title} onChange={(event) => setField('title', event.target.value)} placeholder="e.g. Smoky tomato butter beans" /></label>
                <label className="field field--wide"><span>Short description</span><textarea value={form.description} onChange={(event) => setField('description', event.target.value)} rows="3" placeholder="What makes this recipe special?" /></label>
                <label className="field"><span>Source link</span><input type="url" value={form.sourceUrl} onChange={(event) => setField('sourceUrl', event.target.value)} placeholder="https://" /></label>
                <label className="field"><span>Cuisine</span><select value={form.cuisineId} onChange={(event) => setField('cuisineId', event.target.value)}>{LOOKUPS.cuisines.map((item) => <option key={item.cuisine_id} value={item.cuisine_id}>{item.cuisine_name}</option>)}</select></label>
                <label className="field"><span>Primary meal type</span><select value={form.mealTypeId} onChange={(event) => setField('mealTypeId', event.target.value)}>{LOOKUPS.mealTypes.map((item) => <option key={item.meal_type_id} value={item.meal_type_id}>{item.meal_type_name}</option>)}</select></label>
              </div>
              <div className="picker-field"><span>Dietary suitability</span><ChipPicker items={LOOKUPS.dietaryTags} selected={form.dietaryTagIds} onChange={(value) => setField('dietaryTagIds', value)} idKey="dietary_tag_id" nameKey="dietary_tag_name" /></div>
              <div className="picker-field"><span>Recipe categories</span><ChipPicker items={LOOKUPS.categories} selected={form.categoryIds} onChange={(value) => setField('categoryIds', value)} idKey="category_id" nameKey="category_name" /></div>
            </section>

            <section className="form-section"><div className="section-heading"><span>02</span><div><h2>Ingredients</h2><p>Organize ingredients into useful sections.</p></div></div>
              {form.ingredientSections.map((section, sectionIndex) => <div className="ingredient-section" key={section.id}>
                <div className="ingredient-section__header"><input value={section.name} onChange={(event) => updateSection(section.id, (current) => ({ ...current, name: event.target.value }))} aria-label="Ingredient section name" /><div><span>{section.items.length} item{section.items.length !== 1 ? 's' : ''}</span>{form.ingredientSections.length > 1 && <button type="button" className="text-danger" onClick={() => removeSection(section.id)}>Remove section</button>}</div></div>
                <div className="ingredient-labels"><span>Ingredient</span><span>Quantity</span><span>Unit</span><span>Optional</span><span /></div>
                {section.items.map((item, itemIndex) => <div className="ingredient-row" key={item.id}>
                  <label className="sr-only" htmlFor={`ingredient-${item.id}`}>Ingredient</label><input id={`ingredient-${item.id}`} list="ingredient-options" value={item.ingredientName || ''} onChange={(event) => updateIngredientSearch(section.id, item.id, event.target.value)} placeholder="Search ingredients…" />
                  <input value={item.quantity} onChange={(event) => updateIngredient(section.id, item.id, 'quantity', event.target.value)} placeholder="0" aria-label="Quantity" />
                  <select value={item.unit} onChange={(event) => updateIngredient(section.id, item.id, 'unit', event.target.value)} aria-label="Unit">{LOOKUPS.units.map((unit) => <option key={unit.unit_id} value={unit.unit_name}>{unit.unit_name}</option>)}</select>
                  <label className="check-control"><input type="checkbox" checked={item.optional} onChange={(event) => updateIngredient(section.id, item.id, 'optional', event.target.checked)} /><span><Icon name="check" size={13} /></span></label>
                  <div className="row-actions"><button type="button" onClick={() => moveIngredient(section.id, itemIndex, -1)} disabled={itemIndex === 0} aria-label="Move ingredient up"><Icon name="arrowUp" size={16} /></button><button type="button" onClick={() => moveIngredient(section.id, itemIndex, 1)} disabled={itemIndex === section.items.length - 1} aria-label="Move ingredient down"><Icon name="arrowDown" size={16} /></button><button type="button" onClick={() => removeIngredient(section.id, item.id)} disabled={section.items.length === 1} aria-label="Remove ingredient"><Icon name="trash" size={16} /></button></div>
                </div>)}
                <button type="button" className="add-row" onClick={() => addIngredient(section.id)}><Icon name="plus" size={16} /> Add ingredient</button>
              </div>)}
              <button type="button" className="btn btn--secondary" onClick={addSection}><Icon name="plus" size={17} /> Add ingredient section</button>
            </section>

            <section className="form-section"><div className="section-heading"><span>03</span><div><h2>Method</h2><p>Write clear, numbered cooking steps.</p></div></div>
              <div className="method-list">{form.steps.map((step, index) => <div className="method-row" key={step.id}><span className="step-number">{String(index + 1).padStart(2, '0')}</span><textarea value={step.instruction} onChange={(event) => updateStep(step.id, 'instruction', event.target.value)} placeholder="Describe this step…" rows="2" /><label className="timer-input"><Icon name="clock" size={16} /><input type="number" min="0" value={step.timerMinutes} onChange={(event) => updateStep(step.id, 'timerMinutes', event.target.value)} placeholder="Min" /><span>min</span></label><div className="row-actions"><button type="button" onClick={() => setField('steps', moveItem(form.steps, index, -1))} disabled={index === 0}><Icon name="arrowUp" size={16} /></button><button type="button" onClick={() => setField('steps', moveItem(form.steps, index, 1))} disabled={index === form.steps.length - 1}><Icon name="arrowDown" size={16} /></button><button type="button" onClick={() => removeStep(step.id)} disabled={form.steps.length === 1}><Icon name="trash" size={16} /></button></div></div>)}</div>
              <button type="button" className="add-row add-row--method" onClick={() => setField('steps', [...form.steps, { id: crypto.randomUUID(), instruction: '', timerMinutes: '' }])}><Icon name="plus" size={16} /> Add step</button>
            </section>
          </div>

          <aside className="editor-sidebar">
            <section className="form-section compact"><div className="section-heading"><span>04</span><div><h2>Timing & yield</h2><p>Set expectations at a glance.</p></div></div>
              <label className="field"><span>Servings</span><div className="stepper"><button type="button" onClick={() => setField('servings', Math.max(1, Number(form.servings) - 1))}>−</button><input type="number" min="1" value={form.servings} onChange={(event) => setField('servings', event.target.value)} /><button type="button" onClick={() => setField('servings', Number(form.servings) + 1)}>+</button></div></label>
              <div className="time-grid"><label className="field"><span>Prep time</span><div className="input-suffix"><input type="number" min="0" value={form.prepTime} onChange={(event) => setField('prepTime', event.target.value)} /><span>min</span></div></label><label className="field"><span>Cook time</span><div className="input-suffix"><input type="number" min="0" value={form.cookTime} onChange={(event) => setField('cookTime', event.target.value)} /><span>min</span></div></label></div>
              <div className="total-time"><span>Total time</span><strong>{Number(form.prepTime) + Number(form.cookTime)} min</strong></div>
              <div className="spice-control"><div><span>Spice level</span><strong>{['No heat', 'Mild', 'Medium', 'Hot', 'Very hot', 'Fiery'][form.spiceLevel]}</strong></div><input type="range" min="0" max="5" value={form.spiceLevel} onChange={(event) => setField('spiceLevel', Number(event.target.value))} /><div className="range-labels"><span>Mild</span><span>Very spicy</span></div></div>
            </section>

            <section className="form-section compact"><div className="section-heading"><span>05</span><div><h2>Image & appearance</h2><p>Give the recipe its own look.</p></div></div>
              <div className="image-placeholder"><img src={APPROVED_IMAGES.placeholder} alt="Approved recipe placeholder" /><div><Icon name="image" size={22} /><strong>Approved cover image</strong><small>New recipes use the provided placeholder image.</small></div></div>
              <div className="color-picker"><span>Card accent</span><div>{['#C65D42', '#DA9F5B', '#789070', '#557B8B', '#796C91', '#B86C78'].map((color) => <button type="button" key={color} className={form.accentColor === color ? 'selected' : ''} style={{ '--swatch': color }} onClick={() => setField('accentColor', color)} aria-label={`Choose ${color}`} />)}</div></div>
            </section>

            <section className="form-section compact planning-options"><div className="section-heading"><span>06</span><div><h2>Meal planning</h2><p>Decide when this recipe appears.</p></div></div>
              <Toggle checked={form.includeInSuggestions} onChange={(value) => setField('includeInSuggestions', value)} label="Available in suggestions" />
              <Toggle checked={form.addImmediately} onChange={(value) => setField('addImmediately', value)} label="Add to my meal plan now" />
              {form.addImmediately && <div className="planning-fields">
                <label className="field"><span>Planning week</span><input type="date" value={form.plannedWeek} onChange={(event) => { const newWeek = startOfWeek(parseDateKey(event.target.value)); setField('plannedWeek', formatDateKey(newWeek)); setField('plannedDate', formatDateKey(newWeek)) }} /></label>
                <label className="field"><span>Cooking date</span><input type="date" min={form.plannedWeek} max={formatDateKey(addDays(parseDateKey(form.plannedWeek), 6))} value={form.plannedDate} onChange={(event) => setField('plannedDate', event.target.value)} /></label>
                <label className="field"><span>Serving slot</span><select value={form.plannedMeal} onChange={(event) => setField('plannedMeal', event.target.value)}>{MEAL_SLOTS.map((slot) => <option key={slot}>{slot}</option>)}</select></label>
                <label className="field"><span>Serving time</span><input type="time" value={form.plannedTime} onChange={(event) => setField('plannedTime', event.target.value)} /></label>
              </div>}
            </section>
          </aside>
        </div>
        <footer className="editor-footer"><p><Icon name="sparkles" size={17} /> Your recipe will be saved to this browser.</p><div><button type="button" className="btn btn--ghost" onClick={onClose}>Cancel</button><button type="submit" className="btn btn--primary">Save recipe</button></div></footer>
      </form>
    </div>
  )
}

function RecipeDetail({ recipe, onClose, onPlan }) {
  const grouped = recipe.ingredients.reduce((groups, ingredient) => ({ ...groups, [ingredient.sectionName || 'Main']: [...(groups[ingredient.sectionName || 'Main'] || []), ingredient] }), {})
  const tags = recipe.dietaryTagIds.map((id) => lookupName(LOOKUPS.dietaryTags, id, 'dietary_tag_id', 'dietary_tag_name')).filter(Boolean)
  return <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}><article className="detail-modal">
    <button className="modal-close" onClick={onClose}><Icon name="x" /></button>
    <div className="detail-hero"><img src={recipe.coverImageUrl || APPROVED_IMAGES.placeholder} alt="" /><div className="detail-hero__shade" /><div className="detail-hero__content"><p>{getCuisineName(recipe)} · {getMealName(recipe)}</p><h1>{recipe.title}</h1><div><span><Icon name="clock" size={17} /> {recipe.totalTime} min</span><span><Icon name="users" size={17} /> Serves {recipe.servings}</span><span><Icon name="flame" size={17} /> {['No heat', 'Mild', 'Medium', 'Hot', 'Very hot', 'Fiery'][recipe.spiceLevel]}</span></div></div></div>
    <div className="detail-content"><div className="detail-intro"><div><div className="tag-row">{tags.map((tag) => <span className="soft-tag" key={tag}>{tag}</span>)}</div><p>{recipe.description}</p></div><button className="btn btn--primary" onClick={() => onPlan(recipe)}><Icon name="calendarPlus" size={18} /> Add to plan</button></div>
      <div className="detail-grid"><section><p className="eyebrow">What you’ll need</p><h2>Ingredients</h2>{Object.entries(grouped).map(([section, items]) => <div className="detail-ingredient-section" key={section}><h3>{section}</h3>{items.map((item) => <div className="detail-ingredient" key={item.id}><span>{item.ingredientName}{item.optional ? <em> optional</em> : ''}</span><strong>{item.quantity} {item.unit}</strong></div>)}</div>)}</section>
      <section><p className="eyebrow">Step by step</p><h2>Method</h2><div className="detail-method">{recipe.steps.map((step, index) => <div key={step.id}><span>{String(index + 1).padStart(2, '0')}</span><p>{step.instruction}{Number(step.timerMinutes) > 0 && <small><Icon name="clock" size={14} /> {step.timerMinutes} min</small>}</p></div>)}</div></section></div>
      {recipe.sourceUrl && <a className="source-link" href={recipe.sourceUrl} target="_blank" rel="noreferrer">View original source ↗</a>}
    </div>
  </article></div>
}

function PlanRecipeDialog({ recipe, weekStart, onClose, onAssign }) {
  const suggestedMeal = MEAL_SLOTS.includes(getMealName(recipe)) ? getMealName(recipe) : 'Dinner'
  const [date, setDate] = useState(formatDateKey(weekStart))
  const [meal, setMeal] = useState(suggestedMeal)
  const days = Array.from({ length: 7 }, (_, index) => addDays(weekStart, index))
  return <div className="modal-backdrop"><div className="plan-dialog"><button className="modal-close" onClick={onClose}><Icon name="x" /></button><p className="eyebrow">Add to this week</p><h2>When are you making it?</h2><div className="plan-recipe-preview"><img src={recipe.coverImageUrl || APPROVED_IMAGES.placeholder} alt="" /><div><strong>{recipe.title}</strong><span>{recipe.totalTime} min · serves {recipe.servings}</span></div></div><div className="day-picker">{days.map((day) => <button key={formatDateKey(day)} className={date === formatDateKey(day) ? 'selected' : ''} onClick={() => setDate(formatDateKey(day))}><span>{day.toLocaleDateString('en-US', { weekday: 'short' })}</span><strong>{day.getDate()}</strong></button>)}</div><div className="slot-picker">{MEAL_SLOTS.map((slot) => <button key={slot} className={meal === slot ? 'selected' : ''} onClick={() => setMeal(slot)}>{slot}</button>)}</div><button className="btn btn--primary btn--wide" onClick={() => onAssign(date, meal, recipe.id)}>Add to meal plan</button></div></div>
}

function CatalogView({ recipes, onAdd, onOpen, onPlan }) {
  const [search, setSearch] = useState('')
  const [mealFilter, setMealFilter] = useState('All meals')
  const [categoryFilter, setCategoryFilter] = useState('All recipes')
  const filteredRecipes = recipes.filter((recipe) => {
    const searchMatch = `${recipe.title} ${recipe.description} ${getCuisineName(recipe)}`.toLowerCase().includes(search.toLowerCase())
    const mealMatch = mealFilter === 'All meals' || getMealName(recipe) === mealFilter
    const categoryMatch = categoryFilter === 'All recipes' || recipe.categoryIds.some((id) => lookupName(LOOKUPS.categories, id, 'category_id', 'category_name') === categoryFilter)
    return searchMatch && mealMatch && categoryMatch
  })

  return <>
    <div className="page-hero"><div><p className="eyebrow">Your kitchen, organized</p><h1>Recipe collection</h1><p>Keep every favorite within reach, then turn it into a plan.</p></div><button className="btn btn--primary" onClick={onAdd}><Icon name="plus" size={18} /> New recipe</button></div>
    <div className="catalog-toolbar"><label className="search-box"><Icon name="search" size={19} /><input placeholder="Search recipes, cuisines, ingredients…" value={search} onChange={(event) => setSearch(event.target.value)} /></label><select value={mealFilter} onChange={(event) => setMealFilter(event.target.value)}><option>All meals</option>{MEAL_SLOTS.map((meal) => <option key={meal}>{meal}</option>)}</select><select value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)}><option>All recipes</option>{LOOKUPS.categories.map((category) => <option key={category.category_id}>{category.category_name}</option>)}</select></div>
    <div className="collection-summary"><span><strong>{filteredRecipes.length}</strong> recipes</span><span className="summary-line" /><p>Sorted by newest</p></div>
    {filteredRecipes.length ? <div className="recipe-grid">{filteredRecipes.map((recipe) => <RecipeCard key={recipe.id} recipe={recipe} onOpen={onOpen} onPlan={onPlan} />)}</div> : <div className="empty-state"><Icon name="search" size={30} /><h3>No matching recipes</h3><p>Try a different search or filter.</p></div>}
  </>
}

function PlannerView({ weekStart, setWeekStart, plan, recipesById, onPickSlot, onRemove, onOpen }) {
  const days = Array.from({ length: 7 }, (_, index) => addDays(weekStart, index))
  const today = formatDateKey(new Date())
  return <>
    <div className="page-hero planner-title"><div><p className="eyebrow">Make the week easy</p><h1>Weekly meal plan</h1><p>Choose what’s cooking, one day at a time.</p></div><div className="week-controls"><button className="icon-btn bordered" onClick={() => setWeekStart(addDays(weekStart, -7))}><Icon name="chevronLeft" /></button><div><span>Week of</span><strong>{formatWeekRange(weekStart)}</strong></div><button className="icon-btn bordered" onClick={() => setWeekStart(addDays(weekStart, 7))}><Icon name="chevronRight" /></button><button className="btn btn--secondary today-btn" onClick={() => setWeekStart(startOfWeek())}>Today</button></div></div>
    <div className="planner-week">{days.map((day) => {
      const dateKey = formatDateKey(day)
      return <section className={`planner-day ${dateKey === today ? 'today' : ''}`} key={dateKey}><header><div><span>{day.toLocaleDateString('en-US', { weekday: 'long' })}</span><strong>{day.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</strong></div>{dateKey === today && <i>Today</i>}</header><div className="day-slots">{MEAL_SLOTS.map((slot) => {
        const planKey = `${dateKey}|${slot}`
        const recipe = recipesById[plan[planKey]]
        return <div className={`meal-slot ${recipe ? 'filled' : ''}`} key={slot}><span className="meal-slot__label">{slot}</span>{recipe ? <div className="planned-recipe" style={{ '--accent': recipe.accentColor }}><img src={recipe.coverImageUrl || APPROVED_IMAGES.placeholder} alt="" onClick={() => onOpen(recipe)} /><button className="planned-recipe__name" onClick={() => onOpen(recipe)}>{recipe.title}</button><div className="planned-recipe__actions"><button onClick={() => onPickSlot(dateKey, slot)} aria-label="Replace recipe"><Icon name="edit" size={15} /></button><button onClick={() => onRemove(planKey)} aria-label="Remove recipe"><Icon name="x" size={15} /></button></div></div> : <button className="empty-slot" onClick={() => onPickSlot(dateKey, slot)}><Icon name="plus" size={16} /> Add meal</button>}</div>
      })}</div></section>
    })}</div>
  </>
}

function RecipePickerDialog({ date, meal, recipes, onClose, onAssign }) {
  const [search, setSearch] = useState('')
  const filtered = recipes.filter((recipe) => recipe.title.toLowerCase().includes(search.toLowerCase()))
  return <div className="modal-backdrop"><div className="recipe-picker-dialog"><button className="modal-close" onClick={onClose}><Icon name="x" /></button><p className="eyebrow">{parseDateKey(date).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</p><h2>Choose a {meal.toLowerCase()}</h2><label className="search-box"><Icon name="search" size={18} /><input autoFocus value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search your recipes…" /></label><div className="picker-recipes">{filtered.map((recipe) => <button key={recipe.id} onClick={() => onAssign(date, meal, recipe.id)}><img src={recipe.coverImageUrl || APPROVED_IMAGES.placeholder} alt="" /><span><strong>{recipe.title}</strong><small>{getCuisineName(recipe)} · {recipe.totalTime} min</small></span><Icon name="chevronRight" size={18} /></button>)}</div></div></div>
}

function ShoppingView({ weekStart, plan, recipesById, checked, setChecked, pantry, setPantry }) {
  const [showPantry, setShowPantry] = useState(false)
  const weekKeys = useMemo(() => new Set(Array.from({ length: 7 }, (_, index) => formatDateKey(addDays(weekStart, index)))), [weekStart])
  const plannedRecipes = useMemo(() => Object.entries(plan).filter(([key]) => weekKeys.has(key.split('|')[0])).map(([, recipeId]) => recipesById[recipeId]).filter((recipe) => recipe?.includeInShoppingList), [plan, recipesById, weekKeys])
  const shoppingItems = useMemo(() => {
    const grouped = new Map()
    plannedRecipes.forEach((recipe) => recipe.ingredients.filter((item) => !item.optional).forEach((item) => {
      const key = `${item.ingredientId}|${item.unit}`
      const existing = grouped.get(key)
      const numericQuantity = Number(item.quantity)
      if (existing) {
        if (Number.isFinite(numericQuantity) && existing.numeric) existing.quantity = Number(existing.quantity) + numericQuantity
        else existing.quantity = `${existing.quantity} + ${item.quantity}`
      } else {
        const lookup = LOOKUPS.ingredients.find((ingredient) => ingredient.ingredient_id === item.ingredientId)
        grouped.set(key, { key, ingredientId: item.ingredientId, name: item.ingredientName, category: lookup?.shopping_category || 'Grains & pantry', quantity: item.quantity, unit: item.unit, numeric: Number.isFinite(numericQuantity) })
      }
    }))
    return [...grouped.values()].filter((item) => !pantry[item.ingredientId])
  }, [plannedRecipes, pantry])
  const completeCount = shoppingItems.filter((item) => checked[item.key]).length
  const pantryIngredients = LOOKUPS.ingredients.filter((ingredient) => pantry[ingredient.ingredient_id])

  return <>
    <div className="page-hero"><div><p className="eyebrow">Ready for the week</p><h1>Shopping list</h1><p>Built automatically from {plannedRecipes.length} planned recipe{plannedRecipes.length !== 1 ? 's' : ''}.</p></div><button className="btn btn--secondary" onClick={() => setShowPantry(!showPantry)}><Icon name="leaf" size={18} /> Pantry {pantryIngredients.length ? `(${pantryIngredients.length})` : ''}</button></div>
    {showPantry && <div className="pantry-panel"><div><p className="eyebrow">Already on hand</p><h3>Exclude pantry ingredients</h3><p>Selected items stay off this week’s list.</p></div><div className="pantry-grid">{LOOKUPS.ingredients.map((ingredient) => <label key={ingredient.ingredient_id} className={pantry[ingredient.ingredient_id] ? 'selected' : ''}><input type="checkbox" checked={Boolean(pantry[ingredient.ingredient_id])} onChange={(event) => setPantry((current) => ({ ...current, [ingredient.ingredient_id]: event.target.checked }))} /><span><Icon name="check" size={13} /></span>{ingredient.ingredient_name}</label>)}</div></div>}
    <div className="shopping-summary"><div className="progress-ring" style={{ '--progress': shoppingItems.length ? `${(completeCount / shoppingItems.length) * 360}deg` : '0deg' }}><span>{completeCount}/{shoppingItems.length}</span></div><div><strong>{completeCount === shoppingItems.length && shoppingItems.length ? 'All done!' : `${shoppingItems.length - completeCount} items left`}</strong><p>For {formatWeekRange(weekStart)}</p></div><button className="text-button" onClick={() => setChecked({})}>Clear checks</button></div>
    {shoppingItems.length ? <div className="shopping-layout"><div className="shopping-list">{SHOPPING_CATEGORIES.map((category) => {
      const items = shoppingItems.filter((item) => item.category === category)
      if (!items.length) return null
      return <section key={category}><header><h3>{category}</h3><span>{items.length}</span></header>{items.map((item) => <label className={`shopping-item ${checked[item.key] ? 'checked' : ''}`} key={item.key}><input type="checkbox" checked={Boolean(checked[item.key])} onChange={(event) => setChecked((current) => ({ ...current, [item.key]: event.target.checked }))} /><span className="shopping-check"><Icon name="check" size={14} /></span><strong>{item.name}</strong><em>{item.quantity} {item.unit}</em></label>)}</section>
    })}</div><aside className="shopping-tip"><Icon name="sparkles" size={22} /><h3>Smart list</h3><p>Repeated ingredients are combined when they use the same unit. Optional ingredients stay off the list.</p></aside></div> : <div className="empty-state shopping-empty"><Icon name="shopping" size={32} /><h3>Your list is clear</h3><p>Add recipes to this week’s meal plan and their ingredients will appear here.</p></div>}
  </>
}

export default function App() {
  const [customRecipes, setCustomRecipes] = useStoredState(STORAGE.recipes, [])
  const [plan, setPlan] = useStoredState(STORAGE.plan, {})
  const [checked, setChecked] = useStoredState(STORAGE.checked, {})
  const [pantry, setPantry] = useStoredState(STORAGE.pantry, {})
  const [view, setView] = useState('recipes')
  const [weekStart, setWeekStart] = useState(() => startOfWeek())
  const [showEditor, setShowEditor] = useState(false)
  const [detailRecipe, setDetailRecipe] = useState(null)
  const [planRecipe, setPlanRecipe] = useState(null)
  const [pickerSlot, setPickerSlot] = useState(null)
  const [toast, setToast] = useState('')
  const recipes = useMemo(() => [...customRecipes, ...SEED_RECIPES], [customRecipes])
  const recipesById = useMemo(() => Object.fromEntries(recipes.map((recipe) => [recipe.id, recipe])), [recipes])

  useEffect(() => {
    if (!toast) return undefined
    const timer = setTimeout(() => setToast(''), 2600)
    return () => clearTimeout(timer)
  }, [toast])

  const assignRecipe = (date, meal, recipeId) => {
    setPlan((current) => ({ ...current, [`${date}|${meal}`]: recipeId }))
    setPickerSlot(null)
    setPlanRecipe(null)
    setToast('Added to your meal plan')
  }

  const saveRecipe = (recipe) => {
    setCustomRecipes((current) => [recipe, ...current])
    if (recipe.addImmediately) {
      setPlan((current) => ({ ...current, [`${recipe.plannedDate}|${recipe.plannedMeal}`]: recipe.id }))
      setWeekStart(startOfWeek(parseDateKey(recipe.plannedDate)))
    }
    setShowEditor(false)
    setView('recipes')
    setToast(recipe.addImmediately ? 'Recipe saved and added to your plan' : 'Recipe saved to your collection')
  }

  const nav = [
    { id: 'recipes', label: 'Recipes', icon: 'recipes' },
    { id: 'planner', label: 'Meal planner', icon: 'planner' },
    { id: 'shopping', label: 'Shopping list', icon: 'shopping' },
  ]

  return <div className="app-shell">
    <aside className="sidebar"><button className="brand" onClick={() => setView('recipes')}><span><Icon name="leaf" size={22} /></span><strong>Savor</strong></button><nav>{nav.map((item) => <button key={item.id} className={view === item.id ? 'active' : ''} onClick={() => setView(item.id)}><Icon name={item.icon} size={20} /><span>{item.label}</span>{item.id === 'shopping' && <i>{Object.keys(checked).filter((key) => checked[key]).length}</i>}</button>)}</nav><div className="sidebar-note"><Icon name="sparkles" size={18} /><p><strong>Plan a little.<br />Enjoy a lot.</strong></p><span>Your week, your way.</span></div><div className="profile"><div>SK</div><span><strong>My kitchen</strong><small>Saved locally</small></span></div></aside>
    <div className="mobile-header"><button className="brand"><span><Icon name="leaf" size={20} /></span><strong>Savor</strong></button><button className="btn btn--primary btn--small" onClick={() => setShowEditor(true)}><Icon name="plus" size={16} /> Recipe</button></div>
    <main className="main-content">{view === 'recipes' && <CatalogView recipes={recipes} onAdd={() => setShowEditor(true)} onOpen={setDetailRecipe} onPlan={setPlanRecipe} />}{view === 'planner' && <PlannerView weekStart={weekStart} setWeekStart={setWeekStart} plan={plan} recipesById={recipesById} onPickSlot={(date, meal) => setPickerSlot({ date, meal })} onRemove={(key) => setPlan((current) => { const next = { ...current }; delete next[key]; return next })} onOpen={setDetailRecipe} />}{view === 'shopping' && <ShoppingView weekStart={weekStart} plan={plan} recipesById={recipesById} checked={checked} setChecked={setChecked} pantry={pantry} setPantry={setPantry} />}</main>
    <nav className="mobile-nav">{nav.map((item) => <button key={item.id} className={view === item.id ? 'active' : ''} onClick={() => setView(item.id)}><Icon name={item.icon} size={20} /><span>{item.label}</span></button>)}</nav>
    {showEditor && <RecipeEditor weekStart={weekStart} onClose={() => setShowEditor(false)} onSave={saveRecipe} />}
    {detailRecipe && <RecipeDetail recipe={detailRecipe} onClose={() => setDetailRecipe(null)} onPlan={(recipe) => { setDetailRecipe(null); setPlanRecipe(recipe) }} />}
    {planRecipe && <PlanRecipeDialog recipe={planRecipe} weekStart={weekStart} onClose={() => setPlanRecipe(null)} onAssign={assignRecipe} />}
    {pickerSlot && <RecipePickerDialog date={pickerSlot.date} meal={pickerSlot.meal} recipes={recipes} onClose={() => setPickerSlot(null)} onAssign={assignRecipe} />}
    {toast && <div className="toast"><Icon name="check" size={17} /> {toast}</div>}
  </div>
}

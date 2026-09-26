import { useEffect, useMemo, useState } from 'react'
import { APPROVED_IMAGES } from './approved-images'
import recipesCsv from '../project-assets/recipes.csv?raw'
import recipeIngredientsCsv from '../project-assets/recipe_ingredients.csv?raw'
import recipeStepsCsv from '../project-assets/recipe_steps.csv?raw'
import ingredientsCsv from '../project-assets/ingredients.csv?raw'
import unitsCsv from '../project-assets/units.csv?raw'
import cuisinesCsv from '../project-assets/cuisines.csv?raw'
import mealTypesCsv from '../project-assets/meal_types.csv?raw'
import dietaryTagsCsv from '../project-assets/dietary_tags.csv?raw'
import categoriesCsv from '../project-assets/recipe_categories.csv?raw'

const STORAGE = {
  recipes: 'hearth-user-recipes-v1',
  plan: 'hearth-meal-plan-v1',
  checked: 'hearth-shopping-state-v1',
  pantry: 'hearth-pantry-state-v1',
}

const SLOT_NAMES = ['Breakfast', 'Lunch', 'Dinner', 'Snack']
const CATEGORY_ORDER = ['Produce', 'Meat & seafood', 'Dairy & eggs', 'Grains & pantry', 'Oils & condiments', 'Canned & jarred', 'Spices']
const ACCENTS = ['#C75B3B', '#496B58', '#8A5C3E', '#6B5B83', '#356B75', '#A4474E']

function parseCsv(text) {
  const rows = []
  let row = [], cell = '', quoted = false
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i]
    if (char === '"') {
      if (quoted && text[i + 1] === '"') { cell += '"'; i += 1 }
      else quoted = !quoted
    } else if (char === ',' && !quoted) { row.push(cell); cell = '' }
    else if ((char === '\n' || char === '\r') && !quoted) {
      if (char === '\r' && text[i + 1] === '\n') i += 1
      row.push(cell)
      if (row.some(Boolean)) rows.push(row)
      row = []; cell = ''
    } else cell += char
  }
  if (cell || row.length) { row.push(cell); rows.push(row) }
  const headers = rows.shift() || []
  return rows.map(values => Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ''])))
}

const lookups = {
  ingredients: parseCsv(ingredientsCsv),
  units: parseCsv(unitsCsv),
  cuisines: parseCsv(cuisinesCsv),
  mealTypes: parseCsv(mealTypesCsv),
  dietary: parseCsv(dietaryTagsCsv),
  categories: parseCsv(categoriesCsv),
}

const nameMap = (list, idKey, nameKey) => Object.fromEntries(list.map(item => [item[idKey], item[nameKey]]))
const cuisineNames = nameMap(lookups.cuisines, 'cuisine_id', 'cuisine_name')
const mealNames = nameMap(lookups.mealTypes, 'meal_type_id', 'meal_type_name')
const dietNames = nameMap(lookups.dietary, 'dietary_tag_id', 'dietary_tag_name')
const categoryNames = nameMap(lookups.categories, 'category_id', 'category_name')

const seedIngredientRows = parseCsv(recipeIngredientsCsv)
const seedStepRows = parseCsv(recipeStepsCsv)
const seedRecipes = parseCsv(recipesCsv).map(recipe => ({
  id: recipe.recipe_id,
  title: recipe.title,
  description: recipe.short_description,
  sourceName: recipe.source_name,
  sourceUrl: recipe.source_url,
  servings: Number(recipe.servings),
  prepTime: Number(recipe.prep_time_minutes),
  cookTime: Number(recipe.cook_time_minutes),
  cuisine: recipe.cuisine_id,
  mealType: recipe.meal_type_id,
  dietary: recipe.dietary_tag_ids.split(',').filter(Boolean),
  categories: recipe.category_ids.split(',').filter(Boolean),
  spice: Number(recipe.spice_level_0_to_5),
  accent: recipe.accent_color,
  image: recipe.cover_image_url || APPROVED_IMAGES.placeholder,
  suggestions: recipe.include_in_meal_suggestions.toLowerCase() === 'true',
  includeShopping: true,
  nutrition: false,
  substitutions: true,
  measurement: 'US customary',
  seed: true,
  ingredients: seedIngredientRows.filter(row => row.recipe_id === recipe.recipe_id).map(row => ({
    id: `${recipe.recipe_id}-${row.display_order}`,
    section: row.section_name,
    ingredientId: row.ingredient_id,
    name: row.ingredient_name,
    quantity: Number(row.quantity),
    unit: row.unit,
    notes: row.notes,
    optional: row.optional.toLowerCase() === 'true',
  })),
  steps: seedStepRows.filter(row => row.recipe_id === recipe.recipe_id).map(row => ({
    id: `${recipe.recipe_id}-step-${row.step_number}`,
    instruction: row.instruction,
    timer: Number(row.timer_minutes) || '',
  })),
}))

function loadLocal(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key)) ?? fallback } catch { return fallback }
}

function localDate(date) {
  const copy = new Date(date)
  copy.setMinutes(copy.getMinutes() - copy.getTimezoneOffset())
  return copy.toISOString().slice(0, 10)
}

function mondayOf(value = new Date()) {
  const date = typeof value === 'string' ? new Date(`${value}T12:00:00`) : new Date(value)
  const offset = (date.getDay() + 6) % 7
  date.setDate(date.getDate() - offset)
  return localDate(date)
}

function addDays(value, amount) {
  const date = new Date(`${value}T12:00:00`)
  date.setDate(date.getDate() + amount)
  return localDate(date)
}

function formatDate(value, options = { month: 'short', day: 'numeric' }) {
  return new Intl.DateTimeFormat('en-US', options).format(new Date(`${value}T12:00:00`))
}

function Icon({ name, size = 18 }) {
  const paths = {
    book: <><path d="M4 4.5A2.5 2.5 0 0 1 6.5 2H20v17H6.5A2.5 2.5 0 0 0 4 21.5z"/><path d="M4 4.5v17M8 6h8M8 10h6"/></>,
    calendar: <><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18"/></>,
    basket: <><path d="m5 10 2-6m12 6-2-6M3 10h18l-2 10H5z"/><path d="M9 14v3m6-3v3"/></>,
    plus: <path d="M12 5v14M5 12h14"/>,
    search: <><circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/></>,
    clock: <><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></>,
    users: <><circle cx="9" cy="8" r="3"/><path d="M3 20c0-4 2.5-7 6-7s6 3 6 7M16 5a3 3 0 0 1 0 6M17 14c2.4.7 4 3 4 6"/></>,
    chevronLeft: <path d="m15 18-6-6 6-6"/>,
    chevronRight: <path d="m9 18 6-6-6-6"/>,
    close: <path d="M6 6l12 12M18 6 6 18"/>,
    dots: <><circle cx="5" cy="12" r="1" fill="currentColor"/><circle cx="12" cy="12" r="1" fill="currentColor"/><circle cx="19" cy="12" r="1" fill="currentColor"/></>,
    check: <path d="m5 12 4 4L19 6"/>,
    swap: <><path d="M7 7h11l-3-3M17 17H6l3 3"/><path d="m18 7-3 3M6 17l3-3"/></>,
    trash: <><path d="M4 7h16M9 7V4h6v3M7 7l1 14h8l1-14"/></>,
    arrowUp: <path d="m7 11 5-5 5 5M12 6v12"/>,
    arrowDown: <path d="m7 13 5 5 5-5M12 18V6"/>,
    timer: <><circle cx="12" cy="13" r="8"/><path d="M12 9v5h4M9 2h6"/></>,
    spark: <path d="m12 3 1.2 4.2L17 9l-3.8 1.8L12 15l-1.2-4.2L7 9l3.8-1.8zM5 15l.7 2.3L8 18l-2.3.7L5 21l-.7-2.3L2 18l2.3-.7z"/>,
  }
  return <svg className="icon" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>
}

function App() {
  const [view, setView] = useState('recipes')
  const [userRecipes, setUserRecipes] = useState(() => loadLocal(STORAGE.recipes, []))
  const [plan, setPlan] = useState(() => loadLocal(STORAGE.plan, {}))
  const [checked, setChecked] = useState(() => loadLocal(STORAGE.checked, {}))
  const [pantry, setPantry] = useState(() => loadLocal(STORAGE.pantry, {}))
  const [week, setWeek] = useState(() => mondayOf())
  const [selectedRecipe, setSelectedRecipe] = useState(null)
  const [creating, setCreating] = useState(false)
  const [assigning, setAssigning] = useState(null)
  const recipes = useMemo(() => [...seedRecipes, ...userRecipes], [userRecipes])

  useEffect(() => localStorage.setItem(STORAGE.recipes, JSON.stringify(userRecipes)), [userRecipes])
  useEffect(() => localStorage.setItem(STORAGE.plan, JSON.stringify(plan)), [plan])
  useEffect(() => localStorage.setItem(STORAGE.checked, JSON.stringify(checked)), [checked])
  useEffect(() => localStorage.setItem(STORAGE.pantry, JSON.stringify(pantry)), [pantry])

  const plannedCount = useMemo(() => Object.entries(plan).filter(([key, recipeId]) => key.startsWith(`${week}|`) && recipeId).length, [plan, week])
  const shopping = useMemo(() => buildShoppingList(recipes, plan, week), [recipes, plan, week])
  const shoppingCount = shopping.filter(item => !checked[item.key] && !pantry[item.ingredientId]).length

  function addRecipe(recipe) {
    setUserRecipes(items => [...items, recipe])
    if (recipe.addNow && recipe.plannedDate && recipe.plannedMeal) {
      setPlan(current => ({ ...current, [`${recipe.plannedDate}|${recipe.plannedMeal}`]: recipe.id }))
      setWeek(mondayOf(recipe.plannedDate))
    }
    setCreating(false)
    setSelectedRecipe(recipe)
  }

  function assignRecipe(recipeId) {
    if (!assigning) return
    setPlan(current => ({ ...current, [`${assigning.date}|${assigning.slot}`]: recipeId }))
    setAssigning(null)
  }

  function removeAssignment() {
    if (!assigning) return
    setPlan(current => {
      const next = { ...current }
      delete next[`${assigning.date}|${assigning.slot}`]
      return next
    })
    setAssigning(null)
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <button className="brand" onClick={() => setView('recipes')} aria-label="Hearth home">
          <span className="brand-mark"><span>H</span></span>
          <span><strong>Hearth</strong><small>plan · cook · gather</small></span>
        </button>
        <nav aria-label="Main navigation">
          <button className={view === 'recipes' ? 'active' : ''} onClick={() => setView('recipes')}><Icon name="book"/>Recipes</button>
          <button className={view === 'planner' ? 'active' : ''} onClick={() => setView('planner')}><Icon name="calendar"/>Planner{plannedCount > 0 && <b>{plannedCount}</b>}</button>
          <button className={view === 'shopping' ? 'active' : ''} onClick={() => setView('shopping')}><Icon name="basket"/>Shopping{shoppingCount > 0 && <b>{shoppingCount}</b>}</button>
        </nav>
        <button className="primary new-recipe" onClick={() => setCreating(true)}><Icon name="plus"/>New recipe</button>
      </header>

      <main>
        {view === 'recipes' && <RecipeCatalog recipes={recipes} onOpen={setSelectedRecipe} onCreate={() => setCreating(true)} />}
        {view === 'planner' && <Planner recipes={recipes} plan={plan} week={week} setWeek={setWeek} onAssign={setAssigning} />}
        {view === 'shopping' && <ShoppingList items={shopping} checked={checked} setChecked={setChecked} pantry={pantry} setPantry={setPantry} week={week} setWeek={setWeek} />}
      </main>

      {selectedRecipe && <RecipeDetail recipe={selectedRecipe} onClose={() => setSelectedRecipe(null)} onPlan={() => { setAssigning({ date: addDays(week, 0), slot: mealNames[selectedRecipe.mealType] || 'Dinner', preferred: selectedRecipe.id }); setSelectedRecipe(null) }} />}
      {creating && <RecipeForm onClose={() => setCreating(false)} onSave={addRecipe} week={week} />}
      {assigning && <AssignDialog slot={assigning} recipes={recipes} current={plan[`${assigning.date}|${assigning.slot}`]} onChoose={assignRecipe} onRemove={removeAssignment} onClose={() => setAssigning(null)} />}
    </div>
  )
}

function RecipeCatalog({ recipes, onOpen, onCreate }) {
  const [query, setQuery] = useState('')
  const [meal, setMeal] = useState('All meals')
  const [diet, setDiet] = useState('All diets')
  const visible = recipes.filter(recipe => {
    const haystack = `${recipe.title} ${recipe.description} ${cuisineNames[recipe.cuisine] || ''}`.toLowerCase()
    return haystack.includes(query.toLowerCase()) && (meal === 'All meals' || mealNames[recipe.mealType] === meal) && (diet === 'All diets' || recipe.dietary.some(id => dietNames[id] === diet))
  })
  return (
    <div className="page catalog-page">
      <section className="page-heading">
        <div><p className="eyebrow">YOUR RECIPE BOX</p><h1>What are we cooking?</h1><p>Keep every favorite close, from weeknight wins to slow Sunday projects.</p></div>
        <div className="heading-stat"><strong>{recipes.length}</strong><span>recipes saved</span></div>
      </section>
      <section className="toolbar" aria-label="Recipe filters">
        <label className="search"><Icon name="search"/><span className="sr-only">Search recipes</span><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Search your recipes..." /></label>
        <select value={meal} onChange={event => setMeal(event.target.value)} aria-label="Filter by meal"><option>All meals</option>{lookups.mealTypes.map(item => <option key={item.meal_type_id}>{item.meal_type_name}</option>)}</select>
        <select value={diet} onChange={event => setDiet(event.target.value)} aria-label="Filter by diet"><option>All diets</option>{lookups.dietary.map(item => <option key={item.dietary_tag_id}>{item.dietary_tag_name}</option>)}</select>
      </section>
      {visible.length ? <section className="recipe-grid" aria-label="Recipe catalog">
        {visible.map(recipe => <RecipeCard key={recipe.id} recipe={recipe} onClick={() => onOpen(recipe)} />)}
        <button className="add-card" onClick={onCreate}><span><Icon name="plus" size={24}/></span><strong>Add your own recipe</strong><small>Make this collection yours</small></button>
      </section> : <section className="empty-state"><span><Icon name="search" size={28}/></span><h2>No recipes found</h2><p>Try a different search or filter.</p></section>}
    </div>
  )
}

function RecipeCard({ recipe, onClick }) {
  return (
    <button className="recipe-card" onClick={onClick} style={{ '--accent': recipe.accent }}>
      <span className="card-image-wrap"><img src={recipe.image || APPROVED_IMAGES.placeholder} onError={event => { event.currentTarget.src = APPROVED_IMAGES.placeholder }} alt=""/><span className="meal-pill">{mealNames[recipe.mealType] || 'Recipe'}</span>{!recipe.seed && <span className="personal-pill">Yours</span>}</span>
      <span className="card-body">
        <span className="card-kicker">{cuisineNames[recipe.cuisine] || 'Home cooking'}</span>
        <strong className="card-title">{recipe.title}</strong>
        <span className="card-description">{recipe.description || 'A new favorite for your table.'}</span>
        <span className="card-meta"><span><Icon name="clock"/> {recipe.prepTime + recipe.cookTime} min</span><span><Icon name="users"/> {recipe.servings} servings</span></span>
      </span>
    </button>
  )
}

function WeekControls({ week, setWeek, label = 'Week of' }) {
  return <div className="week-controls"><button className="icon-button" onClick={() => setWeek(addDays(week, -7))} aria-label="Previous week"><Icon name="chevronLeft"/></button><button className="week-label" onClick={() => setWeek(mondayOf())}><small>{label}</small><strong>{formatDate(week)} – {formatDate(addDays(week, 6), { month: 'short', day: 'numeric', year: 'numeric' })}</strong></button><button className="icon-button" onClick={() => setWeek(addDays(week, 7))} aria-label="Next week"><Icon name="chevronRight"/></button></div>
}

function Planner({ recipes, plan, week, setWeek, onAssign }) {
  const days = Array.from({ length: 7 }, (_, index) => addDays(week, index))
  const recipeById = Object.fromEntries(recipes.map(recipe => [recipe.id, recipe]))
  return (
    <div className="page planner-page">
      <section className="planner-heading"><div><p className="eyebrow">WEEKLY RHYTHM</p><h1>Plan the week</h1><p>A little planning now, a lot less wondering later.</p></div><WeekControls week={week} setWeek={setWeek}/></section>
      <section className="planner-grid" aria-label="Weekly meal planner">
        {days.map((date, dayIndex) => <div className={`day-column ${date === localDate(new Date()) ? 'today' : ''}`} key={date}>
          <header><span>{formatDate(date, { weekday: 'short' })}</span><strong>{formatDate(date, { day: 'numeric' })}</strong>{date === localDate(new Date()) && <small>Today</small>}</header>
          <div className="day-slots">{SLOT_NAMES.map(slot => {
            const recipe = recipeById[plan[`${date}|${slot}`]]
            return <button key={slot} className={`meal-slot ${recipe ? 'filled' : ''}`} onClick={() => onAssign({ date, slot })} style={recipe ? { '--accent': recipe.accent } : undefined}>
              <span className="slot-label">{slot}</span>
              {recipe ? <><strong>{recipe.title}</strong><small>{recipe.prepTime + recipe.cookTime} min · {recipe.servings} servings</small><span className="slot-edit"><Icon name="dots"/></span></> : <span className="empty-slot"><Icon name="plus"/> Add meal</span>}
            </button>
          })}</div>
        </div>)}
      </section>
      <p className="planner-tip"><Icon name="spark"/> Select any meal slot to add, replace, or remove a recipe.</p>
    </div>
  )
}

function buildShoppingList(recipes, plan, week) {
  const recipeById = Object.fromEntries(recipes.map(recipe => [recipe.id, recipe]))
  const plannedIds = Object.entries(plan).filter(([key]) => key.startsWith(`${week}|`)).map(([, value]) => value)
  const combined = new Map()
  plannedIds.forEach(id => {
    const recipe = recipeById[id]
    if (!recipe?.includeShopping) return
    recipe.ingredients.forEach(item => {
      const key = `${item.ingredientId || item.name}|${item.unit}`
      const existing = combined.get(key)
      if (existing) { existing.quantity += Number(item.quantity) || 0; existing.recipes.add(recipe.title) }
      else {
        const source = lookups.ingredients.find(ingredient => ingredient.ingredient_id === item.ingredientId)
        combined.set(key, { key: `${week}|${key}`, ingredientId: item.ingredientId || item.name, name: item.name, quantity: Number(item.quantity) || 0, unit: item.unit, optional: item.optional, category: source?.shopping_category || 'Grains & pantry', recipes: new Set([recipe.title]) })
      }
    })
  })
  return [...combined.values()].map(item => ({ ...item, recipes: [...item.recipes] })).sort((a, b) => CATEGORY_ORDER.indexOf(a.category) - CATEGORY_ORDER.indexOf(b.category) || a.name.localeCompare(b.name))
}

function ShoppingList({ items, checked, setChecked, pantry, setPantry, week, setWeek }) {
  const [hidePantry, setHidePantry] = useState(true)
  const visible = items.filter(item => !hidePantry || !pantry[item.ingredientId])
  const groups = CATEGORY_ORDER.map(category => ({ category, items: visible.filter(item => item.category === category) })).filter(group => group.items.length)
  const done = items.filter(item => checked[item.key]).length
  const clearChecked = () => setChecked(current => Object.fromEntries(Object.entries(current).filter(([key]) => !key.startsWith(`${week}|`))))
  return (
    <div className="page shopping-page">
      <section className="planner-heading"><div><p className="eyebrow">FROM YOUR PLAN</p><h1>Shopping list</h1><p>Everything you need, grouped for an easier trip.</p></div><WeekControls week={week} setWeek={setWeek}/></section>
      <section className="shopping-layout">
        <aside className="shopping-summary">
          <div className="progress-ring" style={{ '--progress': items.length ? `${Math.round(done / items.length * 360)}deg` : '0deg' }}><span><strong>{items.length - done}</strong><small>left</small></span></div>
          <h2>{done ? `${done} item${done === 1 ? '' : 's'} collected` : 'Ready when you are'}</h2>
          <p>{items.length ? 'Check things off as they land in your basket.' : 'Add recipes to this week’s meal plan and your list will build itself.'}</p>
          <label className="switch-row"><span><strong>Hide pantry items</strong><small>Items marked “I have this”</small></span><input type="checkbox" checked={hidePantry} onChange={event => setHidePantry(event.target.checked)}/><i/></label>
          {done > 0 && <button className="text-button" onClick={clearChecked}>Clear checked items</button>}
        </aside>
        <div className="shopping-content">
          {groups.length ? groups.map(group => <section className="shopping-group" key={group.category}><header><h2>{group.category}</h2><span>{group.items.length}</span></header>{group.items.map(item => <div className={`shopping-item ${checked[item.key] ? 'checked' : ''}`} key={item.key}>
            <label className="check-label"><input type="checkbox" checked={Boolean(checked[item.key])} onChange={() => setChecked(current => ({ ...current, [item.key]: !current[item.key] }))}/><span className="custom-check"><Icon name="check"/></span><span><strong>{item.name}{item.optional ? ' (optional)' : ''}</strong><small>For {item.recipes.join(', ')}</small></span></label>
            <span className="item-quantity">{Number.isInteger(item.quantity) ? item.quantity : Number(item.quantity.toFixed(2))} {item.unit}</span>
            <button className={`pantry-button ${pantry[item.ingredientId] ? 'active' : ''}`} onClick={() => setPantry(current => ({ ...current, [item.ingredientId]: !current[item.ingredientId] }))}>{pantry[item.ingredientId] ? 'In pantry' : 'I have this'}</button>
          </div>)}</section>) : <section className="empty-state shopping-empty"><span><Icon name="basket" size={28}/></span><h2>Your list is waiting</h2><p>Plan a meal this week and its ingredients will appear here automatically.</p></section>}
        </div>
      </section>
    </div>
  )
}

function Modal({ children, onClose, wide = false, label }) {
  useEffect(() => {
    const close = event => event.key === 'Escape' && onClose()
    document.addEventListener('keydown', close)
    document.body.classList.add('modal-open')
    return () => { document.removeEventListener('keydown', close); document.body.classList.remove('modal-open') }
  }, [onClose])
  return <div className="modal-backdrop" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) onClose() }}><section className={`modal ${wide ? 'wide' : ''}`} role="dialog" aria-modal="true" aria-label={label}>{children}</section></div>
}

function RecipeDetail({ recipe, onClose, onPlan }) {
  const sections = [...new Set(recipe.ingredients.map(item => item.section))]
  return <Modal onClose={onClose} wide label={recipe.title}>
    <button className="modal-close" onClick={onClose} aria-label="Close"><Icon name="close"/></button>
    <div className="detail-hero" style={{ '--accent': recipe.accent }}><img src={recipe.image || APPROVED_IMAGES.placeholder} onError={event => { event.currentTarget.src = APPROVED_IMAGES.placeholder }} alt=""/><div className="detail-overlay"><span className="meal-pill">{cuisineNames[recipe.cuisine]} · {mealNames[recipe.mealType]}</span><h1>{recipe.title}</h1><p>{recipe.description}</p></div></div>
    <div className="detail-content">
      <div className="detail-facts"><span><Icon name="clock"/><small>Prep</small><strong>{recipe.prepTime} min</strong></span><span><Icon name="timer"/><small>Cook</small><strong>{recipe.cookTime} min</strong></span><span><Icon name="users"/><small>Serves</small><strong>{recipe.servings}</strong></span><span><span className="spice-icon">{recipe.spice ? '◆'.repeat(Math.min(recipe.spice, 3)) : '—'}</span><small>Spice</small><strong>{spiceLabel(recipe.spice)}</strong></span></div>
      <div className="tag-row">{recipe.dietary.map(id => <span key={id}>{dietNames[id]}</span>)}{recipe.categories.map(id => <span key={id}>{categoryNames[id]}</span>)}</div>
      <div className="detail-columns"><section><h2>Ingredients</h2>{sections.map(section => <div className="ingredient-section" key={section}><h3>{section}</h3>{recipe.ingredients.filter(item => item.section === section).map(item => <div className="detail-ingredient" key={item.id}><span>{item.name}{item.notes ? <small>, {item.notes}</small> : null}{item.optional ? <em> optional</em> : null}</span><strong>{item.quantity} {item.unit}</strong></div>)}</div>)}</section>
      <section><h2>Method</h2><ol className="method-list">{recipe.steps.map((step, index) => <li key={step.id}><span>{index + 1}</span><div><p>{step.instruction}</p>{step.timer && <small><Icon name="timer"/> {step.timer} minutes</small>}</div></li>)}</ol></section></div>
      <div className="detail-footer"><div>{recipe.sourceUrl ? <a href={recipe.sourceUrl} target="_blank" rel="noreferrer">View original source ↗</a> : <span>From {recipe.sourceName || 'your kitchen'}</span>}</div><button className="primary" onClick={onPlan}><Icon name="calendar"/>Add to meal plan</button></div>
    </div>
  </Modal>
}

function AssignDialog({ slot, recipes, current, onChoose, onRemove, onClose }) {
  const [query, setQuery] = useState('')
  const list = recipes.filter(recipe => recipe.title.toLowerCase().includes(query.toLowerCase()))
  return <Modal onClose={onClose} label={`Choose ${slot.slot}`}>
    <div className="dialog-header"><div><p className="eyebrow">{formatDate(slot.date, { weekday: 'long', month: 'long', day: 'numeric' })}</p><h2>{current ? `Change ${slot.slot.toLowerCase()}` : `Add ${slot.slot.toLowerCase()}`}</h2></div><button className="modal-close inline" onClick={onClose} aria-label="Close"><Icon name="close"/></button></div>
    <label className="search dialog-search"><Icon name="search"/><span className="sr-only">Search recipes</span><input autoFocus value={query} onChange={event => setQuery(event.target.value)} placeholder="Search recipes..."/></label>
    <div className="recipe-picker">{list.map(recipe => <button key={recipe.id} className={current === recipe.id ? 'selected' : ''} onClick={() => onChoose(recipe.id)}><img src={recipe.image || APPROVED_IMAGES.placeholder} onError={event => { event.currentTarget.src = APPROVED_IMAGES.placeholder }} alt=""/><span><strong>{recipe.title}</strong><small>{mealNames[recipe.mealType]} · {recipe.prepTime + recipe.cookTime} min</small></span>{current === recipe.id && <Icon name="check"/>}</button>)}</div>
    {current && <div className="dialog-footer"><button className="danger-text" onClick={onRemove}><Icon name="trash"/>Remove from this meal</button></div>}
  </Modal>
}

function emptyIngredient(section = 'Main') {
  return { id: crypto.randomUUID(), section, ingredientId: '', name: '', quantity: 1, unit: 'piece', notes: '', optional: false }
}
function emptyStep() { return { id: crypto.randomUUID(), instruction: '', timer: '' } }
function spiceLabel(value) { return ['No heat', 'Mild', 'Medium', 'Warm', 'Hot', 'Very spicy'][Number(value)] }

function RecipeForm({ onClose, onSave, week }) {
  const [form, setForm] = useState({
    title: '', description: '', sourceUrl: '', cuisine: 'CU01', mealType: 'MT03', dietary: [], categories: [], servings: 4, prepTime: 10, cookTime: 20, spice: 1, accent: ACCENTS[0], imageName: '', suggestions: true,
    ingredients: [emptyIngredient('Main')], steps: [emptyStep()], addNow: false, planningWeek: week, plannedDate: week, plannedMeal: 'Dinner', plannedDateTime: '', includeShopping: true, nutrition: false, substitutions: true, measurement: 'US customary',
  })
  const [optionsOpen, setOptionsOpen] = useState(false)
  const [errors, setErrors] = useState({})
  const update = (key, value) => setForm(current => ({ ...current, [key]: value }))
  const toggleArray = (key, value) => update(key, form[key].includes(value) ? form[key].filter(item => item !== value) : [...form[key], value])
  const sectionNames = [...new Set(form.ingredients.map(item => item.section))]

  function updateIngredient(id, key, value) {
    update('ingredients', form.ingredients.map(item => {
      if (item.id !== id) return item
      if (key === 'name') {
        const match = lookups.ingredients.find(ingredient => ingredient.ingredient_name.toLowerCase() === value.toLowerCase())
        return { ...item, name: value, ingredientId: match?.ingredient_id || '' }
      }
      return { ...item, [key]: value }
    }))
  }
  function move(listKey, index, direction) {
    const next = [...form[listKey]], target = index + direction
    if (target < 0 || target >= next.length) return
    ;[next[index], next[target]] = [next[target], next[index]]
    update(listKey, next)
  }
  function addSection() {
    const name = window.prompt('Name this ingredient section (for example, Sauce or Garnish):')?.trim()
    if (name) update('ingredients', [...form.ingredients, emptyIngredient(name)])
  }
  function submit(event) {
    event.preventDefault()
    const nextErrors = {}
    if (!form.title.trim()) nextErrors.title = 'Give your recipe a title.'
    if (!form.ingredients.some(item => item.name.trim())) nextErrors.ingredients = 'Add at least one ingredient.'
    if (!form.steps.some(step => step.instruction.trim())) nextErrors.steps = 'Add at least one method step.'
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length) { document.querySelector('.field-error')?.scrollIntoView({ behavior: 'smooth', block: 'center' }); return }
    const ingredientRows = form.ingredients.filter(item => item.name.trim())
    onSave({ ...form, id: `U-${Date.now()}`, title: form.title.trim(), description: form.description.trim(), sourceName: 'Personal recipe', image: APPROVED_IMAGES.placeholder, ingredients: ingredientRows, steps: form.steps.filter(step => step.instruction.trim()), seed: false })
  }
  return <Modal onClose={onClose} wide label="Add a new recipe">
    <form className="recipe-form" onSubmit={submit}>
      <header className="form-header"><div><p className="eyebrow">ADD TO YOUR COLLECTION</p><h1>Create a recipe</h1><p>Capture the details now, enjoy the easy cooking later.</p></div><div className="form-header-actions"><button type="button" className="secondary" onClick={onClose}>Cancel</button><button className="primary" type="submit">Save recipe</button></div></header>
      <div className="form-scroll">
        <FormSection number="01" title="Recipe details" subtitle="The essentials that make this recipe easy to find.">
          <div className="form-grid two"><Field label="Recipe title" required error={errors.title}><input className={errors.title ? 'field-error' : ''} value={form.title} onChange={event => update('title', event.target.value)} placeholder="e.g. Sunday tomato pasta" />{errors.title && <small className="error">{errors.title}</small>}</Field><Field label="Source link"><input type="url" value={form.sourceUrl} onChange={event => update('sourceUrl', event.target.value)} placeholder="https://" /></Field></div>
          <Field label="Short description"><textarea rows="2" value={form.description} onChange={event => update('description', event.target.value)} placeholder="What makes this recipe worth cooking?"/></Field>
          <div className="form-grid two"><Field label="Cuisine"><select value={form.cuisine} onChange={event => update('cuisine', event.target.value)}>{lookups.cuisines.map(item => <option value={item.cuisine_id} key={item.cuisine_id}>{item.cuisine_name}</option>)}</select></Field><Field label="Primary meal"><select value={form.mealType} onChange={event => update('mealType', event.target.value)}>{lookups.mealTypes.map(item => <option value={item.meal_type_id} key={item.meal_type_id}>{item.meal_type_name}</option>)}</select></Field></div>
          <Field label="Dietary suitability"><ChoiceGrid items={lookups.dietary} selected={form.dietary} onToggle={value => toggleArray('dietary', value)} idKey="dietary_tag_id" nameKey="dietary_tag_name" /></Field>
          <Field label="Recipe categories"><ChoiceGrid items={lookups.categories} selected={form.categories} onToggle={value => toggleArray('categories', value)} idKey="category_id" nameKey="category_name" /></Field>
        </FormSection>

        <FormSection number="02" title="Timing & yield" subtitle="Set expectations before the apron goes on.">
          <div className="form-grid four"><Field label="Servings"><div className="stepper"><button type="button" onClick={() => update('servings', Math.max(1, Number(form.servings) - 1))}>−</button><input type="number" min="1" value={form.servings} onChange={event => update('servings', Number(event.target.value))}/><button type="button" onClick={() => update('servings', Number(form.servings) + 1)}>+</button></div></Field><Field label="Prep time"><div className="input-suffix"><input type="number" min="0" value={form.prepTime} onChange={event => update('prepTime', Number(event.target.value))}/><span>min</span></div></Field><Field label="Cook time"><div className="input-suffix"><input type="number" min="0" value={form.cookTime} onChange={event => update('cookTime', Number(event.target.value))}/><span>min</span></div></Field><Field label="Total time"><div className="input-suffix readonly"><input readOnly value={form.prepTime + form.cookTime}/><span>min</span></div></Field></div>
          <Field label={`Spice level — ${spiceLabel(form.spice)}`}><div className="range-wrap"><span>Mild</span><input className="spice-range" type="range" min="0" max="5" value={form.spice} onChange={event => update('spice', Number(event.target.value))}/><span>Very spicy</span></div></Field>
        </FormSection>

        <FormSection number="03" title="Image & appearance" subtitle="Give it a look you’ll recognize at a glance.">
          <div className="image-accent-grid"><Field label="Cover image"><label className="upload-box"><input type="file" accept="image/*" onChange={event => update('imageName', event.target.files?.[0]?.name || '')}/><span><Icon name="plus"/></span><strong>{form.imageName || 'Choose an image'}</strong><small>JPG, PNG or WEBP</small></label></Field><Field label="Recipe card accent"><div className="color-grid">{ACCENTS.map(color => <button type="button" key={color} style={{ background: color }} className={form.accent === color ? 'selected' : ''} onClick={() => update('accent', color)} aria-label={`Select ${color} accent`}>{form.accent === color && <Icon name="check"/>}</button>)}</div></Field></div>
        </FormSection>

        <FormSection number="04" title="Ingredients" subtitle="Group the list the way you naturally cook.">
          {errors.ingredients && <p className="error field-error">{errors.ingredients}</p>}
          <datalist id="ingredient-list">{lookups.ingredients.map(item => <option key={item.ingredient_id} value={item.ingredient_name}/>)}</datalist>
          {sectionNames.map(section => <div className="ingredient-editor" key={section}><div className="editor-heading"><input aria-label="Section name" value={section} onChange={event => update('ingredients', form.ingredients.map(item => item.section === section ? { ...item, section: event.target.value } : item))}/><span>{form.ingredients.filter(item => item.section === section).length} item(s)</span></div>
            {form.ingredients.map((item, index) => item.section === section && <div className="ingredient-row" key={item.id}><span className="drag-handle">⋮⋮</span><label className="row-field ingredient-name"><span>Ingredient</span><input list="ingredient-list" value={item.name} onChange={event => updateIngredient(item.id, 'name', event.target.value)} placeholder="Search ingredients"/></label><label className="row-field quantity"><span>Quantity</span><input type="number" min="0" step="0.25" value={item.quantity} onChange={event => updateIngredient(item.id, 'quantity', Number(event.target.value))}/></label><label className="row-field unit"><span>Unit</span><select value={item.unit} onChange={event => updateIngredient(item.id, 'unit', event.target.value)}>{lookups.units.map(unit => <option key={unit.unit_id}>{unit.unit_name}</option>)}</select></label><label className="optional-check"><input type="checkbox" checked={item.optional} onChange={event => updateIngredient(item.id, 'optional', event.target.checked)}/><span>Optional</span></label><div className="row-actions"><button type="button" onClick={() => move('ingredients', index, -1)} aria-label="Move ingredient up"><Icon name="arrowUp"/></button><button type="button" onClick={() => move('ingredients', index, 1)} aria-label="Move ingredient down"><Icon name="arrowDown"/></button><button type="button" onClick={() => update('ingredients', form.ingredients.filter(row => row.id !== item.id))} aria-label="Remove ingredient"><Icon name="trash"/></button></div></div>)}
            <button type="button" className="add-line" onClick={() => update('ingredients', [...form.ingredients, emptyIngredient(section)])}><Icon name="plus"/>Add ingredient</button>
          </div>)}
          <button type="button" className="secondary dashed" onClick={addSection}><Icon name="plus"/>Add ingredient section</button>
        </FormSection>

        <FormSection number="05" title="Method" subtitle="Turn the recipe into a calm, clear sequence.">
          {errors.steps && <p className="error field-error">{errors.steps}</p>}
          <div className="steps-editor">{form.steps.map((step, index) => <div className="step-row" key={step.id}><span className="step-number">{index + 1}</span><label className="row-field"><span>Instruction</span><textarea rows="2" value={step.instruction} onChange={event => update('steps', form.steps.map(item => item.id === step.id ? { ...item, instruction: event.target.value } : item))} placeholder="Describe this step clearly..."/></label><label className="row-field timer-field"><span>Timer (optional)</span><div className="input-suffix"><input type="number" min="0" value={step.timer} onChange={event => update('steps', form.steps.map(item => item.id === step.id ? { ...item, timer: event.target.value } : item))}/><span>min</span></div></label><div className="row-actions"><button type="button" onClick={() => move('steps', index, -1)} aria-label="Move step up"><Icon name="arrowUp"/></button><button type="button" onClick={() => move('steps', index, 1)} aria-label="Move step down"><Icon name="arrowDown"/></button><button type="button" onClick={() => update('steps', form.steps.filter(item => item.id !== step.id))} aria-label="Remove step"><Icon name="trash"/></button></div></div>)}</div>
          <button type="button" className="add-line" onClick={() => update('steps', [...form.steps, emptyStep()])}><Icon name="plus"/>Add step</button>
        </FormSection>

        <FormSection number="06" title="Meal planning" subtitle="Decide how this recipe joins the week.">
          <label className="setting-row"><span><strong>Show in meal-plan suggestions</strong><small>Keep this recipe easy to discover while planning.</small></span><input type="checkbox" checked={form.suggestions} onChange={event => update('suggestions', event.target.checked)}/><i/></label>
          <label className="setting-row"><span><strong>Add to the meal plan now</strong><small>Choose a day and meal slot before saving.</small></span><input type="checkbox" checked={form.addNow} onChange={event => update('addNow', event.target.checked)}/><i/></label>
          {form.addNow && <div className="planning-box"><div className="form-grid three"><Field label="Planning week"><input type="date" value={form.planningWeek} onChange={event => { update('planningWeek', mondayOf(event.target.value)); update('plannedDate', event.target.value) }}/></Field><Field label="Cooking date"><input type="date" min={form.planningWeek} max={addDays(form.planningWeek, 6)} value={form.plannedDate} onChange={event => update('plannedDate', event.target.value)}/></Field><Field label="Serving time"><select value={form.plannedMeal} onChange={event => update('plannedMeal', event.target.value)}>{SLOT_NAMES.map(slot => <option key={slot}>{slot}</option>)}</select></Field></div><Field label="Specific date & time (optional)"><input type="datetime-local" value={form.plannedDateTime} onChange={event => update('plannedDateTime', event.target.value)}/></Field></div>}
        </FormSection>

        <section className="recipe-options"><button type="button" className="options-trigger" onClick={() => setOptionsOpen(!optionsOpen)} aria-expanded={optionsOpen}><span><Icon name="dots"/><span><strong>Recipe options</strong><small>Shopping, nutrition & measurements</small></span></span><Icon name={optionsOpen ? 'chevronLeft' : 'chevronRight'}/></button>{optionsOpen && <div className="options-panel"><Toggle label="Include ingredients in shopping lists" checked={form.includeShopping} onChange={value => update('includeShopping', value)}/><Toggle label="Show nutrition information" checked={form.nutrition} onChange={value => update('nutrition', value)}/><Toggle label="Allow ingredient substitutions" checked={form.substitutions} onChange={value => update('substitutions', value)}/><div className="measurement-choice"><strong>Measurements</strong><div><button type="button" className={form.measurement === 'US customary' ? 'selected' : ''} onClick={() => update('measurement', 'US customary')}>US customary{form.measurement === 'US customary' && <Icon name="check"/>}</button><button type="button" className={form.measurement === 'Metric' ? 'selected' : ''} onClick={() => update('measurement', 'Metric')}>Metric{form.measurement === 'Metric' && <Icon name="check"/>}</button></div></div></div>}</section>
      </div>
      <footer className="form-footer"><span>Your recipe stays private in this browser.</span><div><button type="button" className="secondary" onClick={onClose}>Cancel</button><button className="primary" type="submit">Save recipe</button></div></footer>
    </form>
  </Modal>
}

function FormSection({ number, title, subtitle, children }) { return <section className="form-section"><header><span>{number}</span><div><h2>{title}</h2><p>{subtitle}</p></div></header><div className="section-content">{children}</div></section> }
function Field({ label, required, error, children }) { return <label className={`field ${error ? 'has-error' : ''}`}><span>{label}{required && <em>*</em>}</span>{children}</label> }
function ChoiceGrid({ items, selected, onToggle, idKey, nameKey }) { return <div className="choice-grid">{items.map(item => <button type="button" key={item[idKey]} className={selected.includes(item[idKey]) ? 'selected' : ''} onClick={() => onToggle(item[idKey])}><span className="mini-check">{selected.includes(item[idKey]) && <Icon name="check"/>}</span>{item[nameKey]}</button>)}</div> }
function Toggle({ label, checked, onChange }) { return <label className="compact-toggle"><span>{label}</span><input type="checkbox" checked={checked} onChange={event => onChange(event.target.checked)}/><i/></label> }

export default App

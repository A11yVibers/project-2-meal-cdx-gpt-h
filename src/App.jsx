import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { APPROVED_IMAGES } from './approved-images.js'
import recipesCsv from '../project-assets/recipes.csv?raw'
import ingredientsCsv from '../project-assets/ingredients.csv?raw'
import recipeIngredientsCsv from '../project-assets/recipe_ingredients.csv?raw'
import stepsCsv from '../project-assets/recipe_steps.csv?raw'
import cuisinesCsv from '../project-assets/cuisines.csv?raw'
import mealTypesCsv from '../project-assets/meal_types.csv?raw'
import dietaryCsv from '../project-assets/dietary_tags.csv?raw'
import categoriesCsv from '../project-assets/recipe_categories.csv?raw'
import unitsCsv from '../project-assets/units.csv?raw'

const STORAGE = {
  recipes: 'harvest-user-recipes-v1',
  plan: 'harvest-meal-plan-v1',
  checked: 'harvest-checked-items-v1',
  pantry: 'harvest-pantry-items-v1',
}

const MEAL_SLOTS = ['Breakfast', 'Lunch', 'Dinner', 'Snack']
const CATEGORY_ORDER = ['Produce', 'Meat & seafood', 'Dairy & eggs', 'Grains & pantry', 'Oils & condiments', 'Canned & jarred', 'Spices']
const ACCENTS = ['#E86F51', '#E5A93D', '#497D64', '#557A95', '#865D78', '#B85C4A']

function parseCsv(text) {
  const rows = []
  let row = []
  let cell = ''
  let quoted = false
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i]
    if (char === '"') {
      if (quoted && text[i + 1] === '"') { cell += '"'; i += 1 }
      else quoted = !quoted
    } else if (char === ',' && !quoted) { row.push(cell); cell = '' }
    else if ((char === '\n' || char === '\r') && !quoted) {
      if (char === '\r' && text[i + 1] === '\n') i += 1
      row.push(cell); cell = ''
      if (row.some(Boolean)) rows.push(row)
      row = []
    } else cell += char
  }
  if (cell || row.length) { row.push(cell); rows.push(row) }
  const [headers, ...body] = rows
  return body.map((values) => Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ''])))
}

function fromStorage(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key)) ?? fallback } catch { return fallback }
}

const lookups = {
  cuisines: parseCsv(cuisinesCsv), mealTypes: parseCsv(mealTypesCsv), dietary: parseCsv(dietaryCsv),
  categories: parseCsv(categoriesCsv), units: parseCsv(unitsCsv), ingredients: parseCsv(ingredientsCsv),
}

const nameBy = (list, idField, nameField, id) => list.find((item) => item[idField] === id)?.[nameField] || id

function buildSeedRecipes() {
  const ingredientRows = parseCsv(recipeIngredientsCsv)
  const stepRows = parseCsv(stepsCsv)
  return parseCsv(recipesCsv).map((recipe) => ({
    id: recipe.recipe_id,
    title: recipe.title,
    description: recipe.short_description,
    sourceName: recipe.source_name,
    sourceUrl: recipe.source_url,
    servings: Number(recipe.servings),
    prep: Number(recipe.prep_time_minutes),
    cook: Number(recipe.cook_time_minutes),
    cuisine: recipe.cuisine_id,
    mealType: recipe.meal_type_id,
    dietary: recipe.dietary_tag_ids.split(',').filter(Boolean),
    categories: recipe.category_ids.split(',').filter(Boolean),
    difficulty: Number(recipe.difficulty_1_to_5),
    spice: Number(recipe.spice_level_0_to_5),
    accent: recipe.accent_color,
    image: recipe.cover_image_url || APPROVED_IMAGES.placeholder,
    suggestion: recipe.include_in_meal_suggestions.toLowerCase() === 'true',
    includeShopping: true,
    showNutrition: true,
    substitutions: true,
    measurement: 'US customary',
    ingredients: ingredientRows.filter((item) => item.recipe_id === recipe.recipe_id).map((item) => ({
      id: `${recipe.recipe_id}-${item.display_order}`,
      section: item.section_name,
      ingredientId: item.ingredient_id,
      name: item.ingredient_name,
      quantity: Number(item.quantity),
      unit: item.unit,
      notes: item.notes,
      optional: item.optional.toLowerCase() === 'true',
    })),
    steps: stepRows.filter((item) => item.recipe_id === recipe.recipe_id).map((item) => ({
      id: `${recipe.recipe_id}-step-${item.step_number}`,
      instruction: item.instruction,
      timer: Number(item.timer_minutes),
    })),
  }))
}

const SEED_RECIPES = buildSeedRecipes()

function mondayOf(date) {
  const next = new Date(date)
  const day = next.getDay() || 7
  next.setDate(next.getDate() - day + 1)
  next.setHours(12, 0, 0, 0)
  return next
}

function dateKey(date) {
  const local = new Date(date)
  const y = local.getFullYear()
  const m = String(local.getMonth() + 1).padStart(2, '0')
  const d = String(local.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function addDays(date, count) {
  const next = new Date(date)
  next.setDate(next.getDate() + count)
  return next
}

function useDialogFocus(open, onClose) {
  const dialogRef = useRef(null)
  useEffect(() => {
    if (!open || !dialogRef.current) return undefined
    const previous = document.activeElement
    const dialog = dialogRef.current
    const getFocusable = () => [...dialog.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])')].filter((element) => !element.disabled)
    getFocusable()[0]?.focus()
    function onKeyDown(event) {
      if (event.key === 'Escape') { event.preventDefault(); onClose() }
      if (event.key !== 'Tab') return
      const focusable = getFocusable()
      if (!focusable.length) return
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus() }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus() }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => { document.removeEventListener('keydown', onKeyDown); previous?.focus() }
  }, [open, onClose])
  return dialogRef
}

function formatWeek(start) {
  const end = addDays(start, 6)
  const startText = start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  const endText = end.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  return `${startText} – ${endText}`
}

function Icon({ name }) {
  const icons = {
    recipes: <><path d="M4 6.5A2.5 2.5 0 0 1 6.5 4H20v15H6.5A2.5 2.5 0 0 1 4 16.5z"/><path d="M4 6.5v10M8 8h8M8 12h6"/></>,
    planner: <><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4M17 3v4M3 10h18M8 14h3M13 14h3M8 18h3"/></>,
    shopping: <><path d="m4 7 2 14h12l2-14zM9 10V5a3 3 0 0 1 6 0v5"/><path d="M8 14h8"/></>,
    plus: <path d="M12 5v14M5 12h14"/>,
    search: <><circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 4 4"/></>,
    clock: <><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></>,
    users: <><circle cx="9" cy="8" r="3"/><path d="M3 20c0-4 2-7 6-7s6 3 6 7M16 5a3 3 0 0 1 0 6M17 14c2.5.5 4 2.5 4 6"/></>,
    chevron: <path d="m9 18 6-6-6-6"/>,
    arrow: <path d="m15 18-6-6 6-6"/>,
    trash: <><path d="M4 7h16M9 7V4h6v3M7 7l1 14h8l1-14M10 11v6M14 11v6"/></>,
    grip: <><path d="M9 5h.01M15 5h.01M9 12h.01M15 12h.01M9 19h.01M15 19h.01"/></>,
    close: <path d="M6 6l12 12M18 6 6 18"/>,
    check: <path d="m5 12 4 4L19 6"/>,
  }
  return <svg aria-hidden="true" viewBox="0 0 24 24" className="icon">{icons[name]}</svg>
}

function App() {
  const [view, setView] = useState('recipes')
  const [selectedId, setSelectedId] = useState(null)
  const [userRecipes, setUserRecipes] = useState(() => fromStorage(STORAGE.recipes, []))
  const [plan, setPlan] = useState(() => fromStorage(STORAGE.plan, {}))
  const [checked, setChecked] = useState(() => fromStorage(STORAGE.checked, {}))
  const [pantry, setPantry] = useState(() => fromStorage(STORAGE.pantry, {}))
  const [weekStart, setWeekStart] = useState(() => mondayOf(new Date()))
  const [toast, setToast] = useState('')
  const recipes = useMemo(() => [...SEED_RECIPES, ...userRecipes], [userRecipes])

  useEffect(() => { localStorage.setItem(STORAGE.recipes, JSON.stringify(userRecipes)) }, [userRecipes])
  useEffect(() => { localStorage.setItem(STORAGE.plan, JSON.stringify(plan)) }, [plan])
  useEffect(() => { localStorage.setItem(STORAGE.checked, JSON.stringify(checked)) }, [checked])
  useEffect(() => { localStorage.setItem(STORAGE.pantry, JSON.stringify(pantry)) }, [pantry])
  useEffect(() => {
    if (!toast) return undefined
    const timeout = window.setTimeout(() => setToast(''), 2600)
    return () => window.clearTimeout(timeout)
  }, [toast])

  function navigate(next, id = null) {
    setSelectedId(id)
    setView(next)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function saveRecipe(recipe, planning) {
    setUserRecipes((current) => [...current, recipe])
    if (planning.addNow && planning.date && planning.slot) {
      const key = `${planning.date}|${planning.slot}`
      setPlan((current) => ({ ...current, [key]: recipe.id }))
    }
    setToast(`${recipe.title} was added to your kitchen.`)
    navigate('recipes')
  }

  const selectedRecipe = recipes.find((recipe) => recipe.id === selectedId)
  const pageTitle = view === 'detail' && selectedRecipe ? selectedRecipe.title : view === 'create' ? 'Create recipe' : view === 'planner' ? 'Weekly meal planner' : view === 'shopping' ? 'Shopping list' : 'Recipe catalog'

  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">Skip to main content</a>
      <Header view={view} navigate={navigate} />
      <main id="main-content" tabIndex="-1">
        {view === 'recipes' && <RecipeCatalog recipes={recipes} navigate={navigate} />}
        {view === 'detail' && selectedRecipe && <RecipeDetail recipe={selectedRecipe} navigate={navigate} setToast={setToast} plan={plan} setPlan={setPlan} weekStart={weekStart} />}
        {view === 'create' && <RecipeForm onSave={saveRecipe} onCancel={() => navigate('recipes')} weekStart={weekStart} />}
        {view === 'planner' && <Planner recipes={recipes} plan={plan} setPlan={setPlan} weekStart={weekStart} setWeekStart={setWeekStart} navigate={navigate} />}
        {view === 'shopping' && <ShoppingList recipes={recipes} plan={plan} checked={checked} setChecked={setChecked} pantry={pantry} setPantry={setPantry} weekStart={weekStart} setWeekStart={setWeekStart} />}
      </main>
      <footer><span className="brand-mark small">H</span><p><strong>Harvest</strong> · Plan well, eat beautifully.</p></footer>
      <div className="sr-only" role="status" aria-live="polite">{toast}</div>
      {toast && <div className="toast"><span className="toast-check"><Icon name="check" /></span>{toast}</div>}
      <span className="sr-only">Current page: {pageTitle}</span>
    </div>
  )
}

function Header({ view, navigate }) {
  const sections = [
    ['recipes', 'recipes', 'Recipes'], ['planner', 'planner', 'Meal planner'], ['shopping', 'shopping', 'Shopping list'],
  ]
  return (
    <header className="site-header">
      <button className="brand" onClick={() => navigate('recipes')} aria-label="Harvest home">
        <span className="brand-mark">H</span><span><strong>Harvest</strong><small>MEAL PLANNER</small></span>
      </button>
      <nav aria-label="Primary navigation">
        {sections.map(([target, icon, label]) => <button key={target} className={(view === target || (target === 'recipes' && ['detail', 'create'].includes(view))) ? 'active' : ''} onClick={() => navigate(target)}><Icon name={icon} />{label}</button>)}
      </nav>
      <button className="primary header-add" onClick={() => navigate('create')}><Icon name="plus" /> Add recipe</button>
    </header>
  )
}

function RecipeCatalog({ recipes, navigate }) {
  const [query, setQuery] = useState('')
  const [mealFilter, setMealFilter] = useState('All meals')
  const [cuisineFilter, setCuisineFilter] = useState('All cuisines')
  const filtered = recipes.filter((recipe) => {
    const meal = nameBy(lookups.mealTypes, 'meal_type_id', 'meal_type_name', recipe.mealType)
    const cuisine = nameBy(lookups.cuisines, 'cuisine_id', 'cuisine_name', recipe.cuisine)
    const haystack = `${recipe.title} ${recipe.description} ${cuisine}`.toLowerCase()
    return haystack.includes(query.toLowerCase()) && (mealFilter === 'All meals' || meal === mealFilter) && (cuisineFilter === 'All cuisines' || cuisine === cuisineFilter)
  })
  return (
    <>
      <section className="hero catalog-hero">
        <div><span className="eyebrow">YOUR KITCHEN, ORGANIZED</span><h1>What are you<br/><em>cooking?</em></h1><p>Browse your collection, discover an old favorite, or add something new to the table.</p></div>
        <div className="hero-art" aria-hidden="true"><span>fresh</span><b>Good food,<br/>thoughtfully<br/>planned.</b><i>✦</i></div>
      </section>
      <section className="catalog-section" aria-labelledby="collection-title">
        <div className="section-heading"><div><span className="eyebrow">MY RECIPES</span><h2 id="collection-title">The collection <span>{recipes.length}</span></h2></div><button className="primary" onClick={() => navigate('create')}><Icon name="plus" /> Add a recipe</button></div>
        <div className="filters">
          <label className="search-field"><span className="sr-only">Search recipes</span><Icon name="search"/><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search recipes, ingredients..." /></label>
          <label><span className="sr-only">Filter by meal type</span><select value={mealFilter} onChange={(event) => setMealFilter(event.target.value)}><option>All meals</option>{lookups.mealTypes.map((item) => <option key={item.meal_type_id}>{item.meal_type_name}</option>)}</select></label>
          <label><span className="sr-only">Filter by cuisine</span><select value={cuisineFilter} onChange={(event) => setCuisineFilter(event.target.value)}><option>All cuisines</option>{lookups.cuisines.map((item) => <option key={item.cuisine_id}>{item.cuisine_name}</option>)}</select></label>
        </div>
        {filtered.length ? <div className="recipe-grid">{filtered.map((recipe) => <RecipeCard key={recipe.id} recipe={recipe} onOpen={() => navigate('detail', recipe.id)} />)}</div> : <div className="empty-state"><span>⌕</span><h3>No recipes found</h3><p>Try a different search or filter.</p></div>}
      </section>
    </>
  )
}

function RecipeCard({ recipe, onOpen }) {
  const meal = nameBy(lookups.mealTypes, 'meal_type_id', 'meal_type_name', recipe.mealType)
  const total = Number(recipe.prep || 0) + Number(recipe.cook || 0)
  return (
    <article className="recipe-card" style={{ '--accent': recipe.accent }}>
      <button className="card-hitbox" onClick={onOpen} aria-label={`View ${recipe.title}`}></button>
      <div className="card-image"><img src={recipe.image || APPROVED_IMAGES.placeholder} onError={(event) => { event.currentTarget.src = APPROVED_IMAGES.placeholder }} alt=""/><span>{meal}</span></div>
      <div className="card-body"><div className="card-kicker">{nameBy(lookups.cuisines, 'cuisine_id', 'cuisine_name', recipe.cuisine)} · {recipe.categories.slice(0, 1).map((id) => nameBy(lookups.categories, 'category_id', 'category_name', id))}</div><h3>{recipe.title}</h3><p>{recipe.description || 'A delicious addition to your recipe collection.'}</p><div className="card-meta"><span><Icon name="clock"/>{total} min</span><span><Icon name="users"/>{recipe.servings} servings</span><span className="round-arrow"><Icon name="chevron"/></span></div></div>
    </article>
  )
}

function RecipeDetail({ recipe, navigate, setToast, plan, setPlan, weekStart }) {
  const [showPlan, setShowPlan] = useState(false)
  const [date, setDate] = useState(dateKey(weekStart))
  const [slot, setSlot] = useState(nameBy(lookups.mealTypes, 'meal_type_id', 'meal_type_name', recipe.mealType))
  const sections = [...new Set(recipe.ingredients.map((item) => item.section))]
  const closePlan = useCallback(() => setShowPlan(false), [])
  const dialogRef = useDialogFocus(showPlan, closePlan)
  function addToPlan() {
    const safeSlot = MEAL_SLOTS.includes(slot) ? slot : 'Dinner'
    setPlan({ ...plan, [`${date}|${safeSlot}`]: recipe.id })
    setShowPlan(false)
    setToast(`${recipe.title} added to ${safeSlot.toLowerCase()}.`)
  }
  return (
    <div className="detail-page">
      <div className="breadcrumb"><button onClick={() => navigate('recipes')}><Icon name="arrow"/> All recipes</button><span>/</span><span>{recipe.title}</span></div>
      <section className="detail-hero" style={{ '--accent': recipe.accent }}>
        <div className="detail-photo"><img src={recipe.image || APPROVED_IMAGES.placeholder} onError={(event) => { event.currentTarget.src = APPROVED_IMAGES.placeholder }} alt={`${recipe.title}, prepared and ready to serve`} /></div>
        <div className="detail-intro"><div className="tag-row"><span>{nameBy(lookups.mealTypes, 'meal_type_id', 'meal_type_name', recipe.mealType)}</span>{recipe.dietary.slice(0, 2).map((id) => <span key={id}>{nameBy(lookups.dietary, 'dietary_tag_id', 'dietary_tag_name', id)}</span>)}</div><span className="eyebrow">{nameBy(lookups.cuisines, 'cuisine_id', 'cuisine_name', recipe.cuisine)} KITCHEN</span><h1>{recipe.title}</h1><p>{recipe.description}</p><div className="detail-stats"><div><small>PREP</small><strong>{recipe.prep} min</strong></div><div><small>COOK</small><strong>{recipe.cook} min</strong></div><div><small>TOTAL</small><strong>{Number(recipe.prep) + Number(recipe.cook)} min</strong></div><div><small>SERVES</small><strong>{recipe.servings}</strong></div></div><button className="primary wide" onClick={() => setShowPlan(true)}>Add to meal plan <Icon name="chevron"/></button></div>
      </section>
      <div className="detail-content">
        <section className="ingredients-panel"><span className="eyebrow">WHAT YOU'LL NEED</span><h2>Ingredients</h2>{sections.map((section) => <div className="ingredient-group" key={section}><h3>{section}</h3>{recipe.ingredients.filter((item) => item.section === section).map((item) => <div className="ingredient-line" key={item.id}><span>{item.quantity} {item.unit}</span><p><strong>{item.name}</strong>{item.notes && `, ${item.notes}`}{item.optional && <em> · optional</em>}</p></div>)}</div>)}</section>
        <section className="method-panel"><span className="eyebrow">STEP BY STEP</span><h2>Method</h2><ol className="method-list">{recipe.steps.map((step, index) => <li key={step.id}><span>{String(index + 1).padStart(2, '0')}</span><div><p>{step.instruction}</p>{step.timer > 0 && <small><Icon name="clock"/> {step.timer} minutes</small>}</div></li>)}</ol><aside className="source-note"><span>✦</span><div><small>RECIPE SOURCE</small>{recipe.sourceUrl ? <a href={recipe.sourceUrl} target="_blank" rel="noreferrer">{recipe.sourceName || 'Open source recipe'}</a> : <strong>{recipe.sourceName || 'Your kitchen'}</strong>}</div></aside></section>
      </div>
      {showPlan && <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && closePlan()}><section ref={dialogRef} className="modal" role="dialog" aria-modal="true" aria-labelledby="plan-modal-title"><button className="icon-button modal-close" onClick={closePlan} aria-label="Close"><Icon name="close"/></button><span className="eyebrow">PLAN THIS RECIPE</span><h2 id="plan-modal-title">When are you cooking?</h2><label>Date<input type="date" value={date} onChange={(event) => setDate(event.target.value)}/></label><label>Meal slot<select value={MEAL_SLOTS.includes(slot) ? slot : 'Dinner'} onChange={(event) => setSlot(event.target.value)}>{MEAL_SLOTS.map((item) => <option key={item}>{item}</option>)}</select></label><button className="primary wide" onClick={addToPlan}>Add to plan</button></section></div>}
    </div>
  )
}

function RecipeForm({ onSave, onCancel, weekStart }) {
  const [form, setForm] = useState({ title: '', sourceUrl: '', cuisine: 'CU01', mealType: 'MT03', dietary: [], categories: [], servings: 4, prep: 15, cook: 30, spice: 1, accent: ACCENTS[0], suggestion: true, addNow: false, planWeek: dateKey(weekStart), planDate: dateKey(weekStart), planSlot: 'Dinner', planTime: '18:30', includeShopping: true, showNutrition: false, substitutions: true, measurement: 'US customary' })
  const [ingredients, setIngredients] = useState([{ id: crypto.randomUUID(), section: 'Main', ingredientId: '', quantity: '', unit: 'cup', optional: false }])
  const [steps, setSteps] = useState([{ id: crypto.randomUUID(), instruction: '', timer: '' }])
  const [imagePreview, setImagePreview] = useState('')
  const [imageName, setImageName] = useState('')
  const [errors, setErrors] = useState({})
  const titleRef = useRef(null)
  const total = Number(form.prep || 0) + Number(form.cook || 0)
  const ingredientNames = lookups.ingredients.map((item) => item.ingredient_name)
  const unitNames = lookups.units.map((item) => item.unit_name)

  useEffect(() => () => { if (imagePreview.startsWith('blob:')) URL.revokeObjectURL(imagePreview) }, [imagePreview])
  const update = (key, value) => setForm((current) => ({ ...current, [key]: value }))
  const toggleArray = (key, value) => setForm((current) => ({ ...current, [key]: current[key].includes(value) ? current[key].filter((item) => item !== value) : [...current[key], value] }))
  function patchIngredient(id, key, value) { setIngredients((current) => current.map((item) => item.id === id ? { ...item, [key]: value } : item)) }
  function patchStep(id, key, value) { setSteps((current) => current.map((item) => item.id === id ? { ...item, [key]: value } : item)) }
  function move(list, setter, index, direction) { const target = index + direction; if (target < 0 || target >= list.length) return; const next = [...list]; [next[index], next[target]] = [next[target], next[index]]; setter(next) }
  function addSection() {
    const label = window.prompt('Name this ingredient section', 'Sauce')?.trim()
    if (label) setIngredients((current) => [...current, { id: crypto.randomUUID(), section: label, ingredientId: '', quantity: '', unit: 'tbsp', optional: false }])
  }
  function submit(event) {
    event.preventDefault()
    const nextErrors = {}
    if (!form.title.trim()) nextErrors.title = 'Enter a recipe title.'
    if (!ingredients.some((item) => item.ingredientId || item.name)) nextErrors.ingredients = 'Add at least one ingredient.'
    if (!steps.some((step) => step.instruction.trim())) nextErrors.steps = 'Add at least one method step.'
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length) { titleRef.current?.focus(); return }
    const cleanIngredients = ingredients.filter((item) => item.ingredientId || item.name).map((item) => {
      const match = lookups.ingredients.find((ingredient) => ingredient.ingredient_id === item.ingredientId || ingredient.ingredient_name === item.name)
      return { ...item, ingredientId: match?.ingredient_id || '', name: match?.ingredient_name || item.name, quantity: Number(item.quantity) || 0 }
    })
    onSave({
      id: `U-${Date.now()}`, title: form.title.trim(), description: `A ${nameBy(lookups.cuisines, 'cuisine_id', 'cuisine_name', form.cuisine).toLowerCase()} recipe for your collection.`, sourceUrl: form.sourceUrl, sourceName: form.sourceUrl ? 'Original source' : 'Your kitchen', cuisine: form.cuisine, mealType: form.mealType, dietary: form.dietary, categories: form.categories, servings: Number(form.servings), prep: Number(form.prep), cook: Number(form.cook), spice: Number(form.spice), accent: form.accent, image: APPROVED_IMAGES.placeholder, suggestion: form.suggestion, includeShopping: form.includeShopping, showNutrition: form.showNutrition, substitutions: form.substitutions, measurement: form.measurement, ingredients: cleanIngredients, steps: steps.filter((step) => step.instruction.trim()).map((step) => ({ ...step, timer: Number(step.timer) || 0 })), imageName,
    }, { addNow: form.addNow, date: form.planDate, slot: form.planSlot })
  }
  return (
    <div className="form-page">
      <div className="form-topbar"><button onClick={onCancel}><Icon name="arrow"/> Back to recipes</button><div><span className="eyebrow">A NEW FAVORITE</span><h1>Create a recipe</h1><p>Capture the details now, enjoy it for years.</p></div><span className="form-draft">Saved locally when published</span></div>
      <form onSubmit={submit} noValidate>
        <FormSection number="01" title="Recipe details" subtitle="Start with the essentials.">
          <div className="field-grid two"><label className="field full">Recipe title <span>*</span><input ref={titleRef} value={form.title} onChange={(event) => update('title', event.target.value)} aria-invalid={Boolean(errors.title)} aria-describedby={errors.title ? 'title-error' : undefined} placeholder="e.g. Sunday lemon roast chicken"/>{errors.title && <small id="title-error" className="error" role="alert">{errors.title}</small>}</label><label className="field full">Source link <small>OPTIONAL</small><input type="url" value={form.sourceUrl} onChange={(event) => update('sourceUrl', event.target.value)} placeholder="https://..."/></label><label className="field">Cuisine<select value={form.cuisine} onChange={(event) => update('cuisine', event.target.value)}>{lookups.cuisines.map((item) => <option key={item.cuisine_id} value={item.cuisine_id}>{item.cuisine_name}</option>)}</select></label><label className="field">Primary meal type<select value={form.mealType} onChange={(event) => update('mealType', event.target.value)}>{lookups.mealTypes.map((item) => <option key={item.meal_type_id} value={item.meal_type_id}>{item.meal_type_name}</option>)}</select></label></div>
          <ChoiceGroup label="Dietary suitability" items={lookups.dietary} selected={form.dietary} idKey="dietary_tag_id" nameKey="dietary_tag_name" onToggle={(id) => toggleArray('dietary', id)} />
          <ChoiceGroup label="Recipe categories" items={lookups.categories} selected={form.categories} idKey="category_id" nameKey="category_name" onToggle={(id) => toggleArray('categories', id)} />
        </FormSection>
        <FormSection number="02" title="Timing & yield" subtitle="Set expectations for the cook.">
          <div className="timing-grid"><label className="field">Servings<input type="number" min="1" max="50" value={form.servings} onChange={(event) => update('servings', event.target.value)}/></label><label className="field">Prep time <small>MIN</small><input type="number" min="0" value={form.prep} onChange={(event) => update('prep', event.target.value)}/></label><label className="field">Cook time <small>MIN</small><input type="number" min="0" value={form.cook} onChange={(event) => update('cook', event.target.value)}/></label><label className="field total-field">Total time <small>AUTO</small><output>{total} min</output></label></div>
          <fieldset className="spice-field"><legend>Spice level</legend><div><span>Mild</span><input type="range" min="0" max="5" value={form.spice} onChange={(event) => update('spice', event.target.value)} aria-label="Spice level from mild to very spicy"/><span>Very spicy</span></div><div className="spice-dots" aria-hidden="true">{[0,1,2,3,4,5].map((item) => <i className={Number(form.spice) >= item ? 'filled' : ''} key={item}>◆</i>)}</div></fieldset>
        </FormSection>
        <FormSection number="03" title="Image & appearance" subtitle="Give your recipe a little personality.">
          <div className="appearance-grid"><div><label className="image-upload"><input type="file" accept="image/*" onChange={(event) => { const file = event.target.files?.[0]; if (imagePreview.startsWith('blob:')) URL.revokeObjectURL(imagePreview); setImagePreview(file ? URL.createObjectURL(file) : ''); setImageName(file?.name || '') }}/>{imagePreview ? <img src={imagePreview} alt="Selected recipe cover preview"/> : <><span>↥</span><strong>Upload cover image</strong><small>JPG, PNG or WEBP · previewed locally</small></>}</label>{imageName && <p className="upload-note">{imageName} · the approved placeholder will be used after refresh.</p>}</div><fieldset className="color-field"><legend>Card accent color</legend><div>{ACCENTS.map((color) => <label key={color} style={{ '--swatch': color }}><input type="radio" name="accent" value={color} checked={form.accent === color} onChange={() => update('accent', color)}/><span aria-hidden="true"></span><span className="sr-only">Accent {color}</span></label>)}</div><div className="mini-card" style={{ '--accent': form.accent }}><span></span><div><i></i><b>{form.title || 'Your recipe title'}</b><small>{total} min · {form.servings} servings</small></div></div></fieldset></div>
        </FormSection>
        <FormSection number="04" title="Ingredients" subtitle="Organize ingredients into helpful groups.">
          {errors.ingredients && <p className="error banner-error" role="alert">{errors.ingredients}</p>}
          <datalist id="ingredient-options">{ingredientNames.map((name) => <option key={name} value={name}/>)}</datalist>
          <datalist id="unit-options">{unitNames.map((name) => <option key={name} value={name}/>)}</datalist>
          {[...new Set(ingredients.map((item) => item.section))].map((section) => <div className="ingredient-section-editor" key={section}><div className="subsection-title"><h3>{section}</h3><span>{ingredients.filter((item) => item.section === section).length} items</span></div>{ingredients.map((item, index) => item.section === section && <div className="ingredient-row" key={item.id}><span className="drag"><Icon name="grip"/></span><label><span>Ingredient</span><input list="ingredient-options" value={item.name || nameBy(lookups.ingredients, 'ingredient_id', 'ingredient_name', item.ingredientId)} onChange={(event) => { const match = lookups.ingredients.find((ingredient) => ingredient.ingredient_name === event.target.value); patchIngredient(item.id, 'name', event.target.value); patchIngredient(item.id, 'ingredientId', match?.ingredient_id || '') }} placeholder="Search ingredient"/></label><label><span>Qty</span><input type="number" min="0" step="any" value={item.quantity} onChange={(event) => patchIngredient(item.id, 'quantity', event.target.value)}/></label><label><span>Unit</span><input list="unit-options" value={item.unit} onChange={(event) => patchIngredient(item.id, 'unit', event.target.value)}/></label><label className="optional-check"><input type="checkbox" checked={item.optional} onChange={(event) => patchIngredient(item.id, 'optional', event.target.checked)}/><span>Optional</span></label><div className="row-actions"><button type="button" onClick={() => move(ingredients, setIngredients, index, -1)} aria-label={`Move ${item.name || 'ingredient'} up`}>↑</button><button type="button" onClick={() => move(ingredients, setIngredients, index, 1)} aria-label={`Move ${item.name || 'ingredient'} down`}>↓</button><button type="button" onClick={() => setIngredients((current) => current.filter((entry) => entry.id !== item.id))} aria-label={`Remove ${item.name || 'ingredient'}`}><Icon name="trash"/></button></div></div>)}<button type="button" className="text-button" onClick={() => setIngredients((current) => [...current, { id: crypto.randomUUID(), section, ingredientId: '', name: '', quantity: '', unit: 'cup', optional: false }])}><Icon name="plus"/> Add ingredient</button></div>)}
          <button type="button" className="secondary dashed" onClick={addSection}><Icon name="plus"/> Add ingredient section</button>
        </FormSection>
        <FormSection number="05" title="Method" subtitle="Guide the cook, one clear step at a time.">
          {errors.steps && <p className="error banner-error" role="alert">{errors.steps}</p>}
          <ol className="step-editor">{steps.map((step, index) => <li key={step.id}><span className="step-number">{String(index + 1).padStart(2, '0')}</span><label className="field"><span className="sr-only">Step {index + 1} instruction</span><textarea value={step.instruction} onChange={(event) => patchStep(step.id, 'instruction', event.target.value)} placeholder="Describe this step clearly..."/></label><label className="field timer-input"><span><Icon name="clock"/> Timer <small>MIN</small></span><input type="number" min="0" value={step.timer} onChange={(event) => patchStep(step.id, 'timer', event.target.value)} placeholder="—"/></label><div className="row-actions"><button type="button" onClick={() => move(steps, setSteps, index, -1)} aria-label={`Move step ${index + 1} up`}>↑</button><button type="button" onClick={() => move(steps, setSteps, index, 1)} aria-label={`Move step ${index + 1} down`}>↓</button><button type="button" onClick={() => setSteps((current) => current.filter((entry) => entry.id !== step.id))} aria-label={`Remove step ${index + 1}`}><Icon name="trash"/></button></div></li>)}</ol><button type="button" className="secondary dashed" onClick={() => setSteps((current) => [...current, { id: crypto.randomUUID(), instruction: '', timer: '' }])}><Icon name="plus"/> Add another step</button>
        </FormSection>
        <FormSection number="06" title="Meal planning" subtitle="Choose how this recipe fits your week.">
          <div className="planning-options"><Toggle label="Available in meal-plan suggestions" description="Let this recipe appear when filling open slots." checked={form.suggestion} onChange={(value) => update('suggestion', value)}/><Toggle label="Add to meal plan now" description="Schedule it as soon as the recipe is saved." checked={form.addNow} onChange={(value) => update('addNow', value)}/></div>
          {form.addNow && <div className="planning-grid"><label className="field">Planning week<input type="date" value={form.planWeek} onChange={(event) => update('planWeek', event.target.value)}/></label><label className="field">Cooking date<input type="date" value={form.planDate} onChange={(event) => update('planDate', event.target.value)}/></label><label className="field">Serving time<select value={form.planSlot} onChange={(event) => update('planSlot', event.target.value)}>{MEAL_SLOTS.map((item) => <option key={item}>{item}</option>)}</select></label><label className="field">Specific time<input type="time" value={form.planTime} onChange={(event) => update('planTime', event.target.value)}/></label></div>}
        </FormSection>
        <FormSection number="07" title="Recipe options" subtitle="Fine-tune how this recipe behaves.">
          <div className="options-menu"><Toggle label="Include ingredients in shopping lists" description="Add ingredients whenever this recipe is planned." checked={form.includeShopping} onChange={(value) => update('includeShopping', value)}/><Toggle label="Show nutrition information" description="Display nutrition details on the recipe." checked={form.showNutrition} onChange={(value) => update('showNutrition', value)}/><Toggle label="Allow ingredient substitutions" description="Suggest flexible swaps when available." checked={form.substitutions} onChange={(value) => update('substitutions', value)}/><fieldset className="measurement-choice"><legend>Measurement system</legend><label className={form.measurement === 'US customary' ? 'selected' : ''}><input type="radio" name="measurement" checked={form.measurement === 'US customary'} onChange={() => update('measurement', 'US customary')}/><span><Icon name="check"/></span>US customary</label><label className={form.measurement === 'Metric' ? 'selected' : ''}><input type="radio" name="measurement" checked={form.measurement === 'Metric'} onChange={() => update('measurement', 'Metric')}/><span><Icon name="check"/></span>Metric</label></fieldset></div>
        </FormSection>
        <div className="form-actions"><button type="button" className="secondary" onClick={onCancel}>Cancel</button><button className="primary" type="submit">Save recipe <Icon name="chevron"/></button></div>
      </form>
    </div>
  )
}

function FormSection({ number, title, subtitle, children }) {
  return <section className="form-section"><div className="form-section-heading"><span>{number}</span><div><h2>{title}</h2><p>{subtitle}</p></div></div><div className="form-section-body">{children}</div></section>
}

function ChoiceGroup({ label, items, selected, idKey, nameKey, onToggle }) {
  return <fieldset className="choice-group"><legend>{label}</legend><div>{items.map((item) => <label className={selected.includes(item[idKey]) ? 'selected' : ''} key={item[idKey]}><input type="checkbox" checked={selected.includes(item[idKey])} onChange={() => onToggle(item[idKey])}/><span><Icon name="check"/></span>{item[nameKey]}</label>)}</div></fieldset>
}

function Toggle({ label, description, checked, onChange }) {
  return <label className="toggle-row"><span><strong>{label}</strong><small>{description}</small></span><input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)}/><i aria-hidden="true"></i></label>
}

function Planner({ recipes, plan, setPlan, weekStart, setWeekStart, navigate }) {
  const [editing, setEditing] = useState(null)
  const closePicker = useCallback(() => setEditing(null), [])
  const pickerRef = useDialogFocus(Boolean(editing), closePicker)
  const days = Array.from({ length: 7 }, (_, index) => addDays(weekStart, index))
  function assign(recipeId) { setPlan((current) => ({ ...current, [editing]: recipeId })); setEditing(null) }
  const plannedCount = Object.entries(plan).filter(([key]) => days.some((day) => key.startsWith(dateKey(day)))).length
  return (
    <div className="planner-page">
      <section className="page-hero compact"><div><span className="eyebrow">YOUR WEEK AT A GLANCE</span><h1>Meal planner</h1><p>Make space for good meals, one day at a time.</p></div><div className="week-stat"><strong>{plannedCount}</strong><span>meals planned<br/>this week</span></div></section>
      <div className="planner-toolbar"><button className="icon-button" onClick={() => setWeekStart(addDays(weekStart, -7))} aria-label="Previous week"><Icon name="arrow"/></button><div><small>WEEK OF</small><h2>{formatWeek(weekStart)}</h2></div><button className="icon-button next" onClick={() => setWeekStart(addDays(weekStart, 7))} aria-label="Next week"><Icon name="chevron"/></button><button className="text-button today" onClick={() => setWeekStart(mondayOf(new Date()))}>Today</button></div>
      <section className="calendar" aria-label={`Meal plan for ${formatWeek(weekStart)}`}>
        {days.map((day) => <article className={dateKey(day) === dateKey(new Date()) ? 'today-column' : ''} key={dateKey(day)}><header><small>{day.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase()}</small><strong>{day.getDate()}</strong><span>{day.toLocaleDateString('en-US', { month: 'short' })}</span></header>{MEAL_SLOTS.map((slot) => { const key = `${dateKey(day)}|${slot}`; const recipe = recipes.find((item) => item.id === plan[key]); return <div className="meal-slot" key={slot}><small>{slot.toUpperCase()}</small>{recipe ? <div className="planned-card" style={{ '--accent': recipe.accent }}><button className="planned-open" onClick={() => navigate('detail', recipe.id)}><img src={recipe.image || APPROVED_IMAGES.placeholder} alt=""/><strong>{recipe.title}</strong><span>{Number(recipe.prep) + Number(recipe.cook)} min</span></button><div><button onClick={() => setEditing(key)}>Replace</button><button onClick={() => setPlan((current) => { const next = { ...current }; delete next[key]; return next })}>Remove</button></div></div> : <button className="empty-slot" onClick={() => setEditing(key)}><Icon name="plus"/><span>Add {slot.toLowerCase()}</span></button>}</div>})}</article>)}
      </section>
      {editing && <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && closePicker()}><section ref={pickerRef} className="modal recipe-picker" role="dialog" aria-modal="true" aria-labelledby="picker-title"><button className="icon-button modal-close" onClick={closePicker} aria-label="Close"><Icon name="close"/></button><span className="eyebrow">CHOOSE A RECIPE</span><h2 id="picker-title">Fill this meal slot</h2><div>{recipes.filter((recipe) => recipe.suggestion !== false).map((recipe) => <button key={recipe.id} onClick={() => assign(recipe.id)}><img src={recipe.image || APPROVED_IMAGES.placeholder} alt=""/><span><strong>{recipe.title}</strong><small>{nameBy(lookups.mealTypes, 'meal_type_id', 'meal_type_name', recipe.mealType)} · {Number(recipe.prep) + Number(recipe.cook)} min</small></span><Icon name="chevron"/></button>)}</div></section></div>}
    </div>
  )
}

function ShoppingList({ recipes, plan, checked, setChecked, pantry, setPantry, weekStart, setWeekStart }) {
  const days = Array.from({ length: 7 }, (_, index) => dateKey(addDays(weekStart, index)))
  const plannedRecipes = Object.entries(plan).filter(([key]) => days.some((day) => key.startsWith(day))).map(([, id]) => recipes.find((recipe) => recipe.id === id)).filter((recipe) => recipe?.includeShopping !== false)
  const grouped = useMemo(() => {
    const bucket = new Map()
    plannedRecipes.forEach((recipe) => recipe.ingredients.forEach((ingredient) => {
      if (ingredient.optional) return
      const key = `${ingredient.name}|${ingredient.unit}`
      const entry = bucket.get(key) || { ...ingredient, quantity: 0, recipeNames: new Set() }
      entry.quantity += Number(ingredient.quantity || 0)
      entry.recipeNames.add(recipe.title)
      bucket.set(key, entry)
    }))
    return [...bucket.values()].map((item) => ({ ...item, recipeNames: [...item.recipeNames], category: lookups.ingredients.find((ingredient) => ingredient.ingredient_id === item.ingredientId || ingredient.ingredient_name === item.name)?.shopping_category || 'Grains & pantry' }))
  }, [plannedRecipes])
  const visible = grouped.filter((item) => !pantry[`${item.name}|${item.unit}`])
  const completed = visible.filter((item) => checked[`${item.name}|${item.unit}`]).length
  return (
    <div className="shopping-page">
      <section className="page-hero shopping-hero"><div><span className="eyebrow">FROM PLAN TO PANTRY</span><h1>Shopping list</h1><p>Everything you need for a delicious week, gathered in one place.</p></div><div className="bag-art" aria-hidden="true">HARVEST<span>market list</span><b>✦</b></div></section>
      <div className="shopping-toolbar"><div className="week-switcher"><button className="icon-button" onClick={() => setWeekStart(addDays(weekStart, -7))} aria-label="Previous week"><Icon name="arrow"/></button><div><small>SHOPPING FOR</small><strong>{formatWeek(weekStart)}</strong></div><button className="icon-button next" onClick={() => setWeekStart(addDays(weekStart, 7))} aria-label="Next week"><Icon name="chevron"/></button></div><div className="progress-wrap"><span>{completed} of {visible.length} collected</span><div><i style={{ width: visible.length ? `${(completed / visible.length) * 100}%` : '0%' }}></i></div></div></div>
      {!grouped.length ? <div className="empty-state shopping-empty"><span>◌</span><h2>Your list is waiting</h2><p>Add recipes to this week’s meal plan and their ingredients will appear here automatically.</p></div> : <div className="shopping-layout"><section className="shopping-list" aria-label="Shopping items">{CATEGORY_ORDER.map((category) => { const items = visible.filter((item) => item.category === category); if (!items.length) return null; return <div className="shopping-category" key={category}><div className="shopping-category-title"><span>{category === 'Produce' ? '♧' : category === 'Meat & seafood' ? '◇' : category === 'Dairy & eggs' ? '◉' : category === 'Spices' ? '✣' : '◌'}</span><h2>{category}</h2><small>{items.length}</small></div>{items.map((item) => { const key = `${item.name}|${item.unit}`; return <div className={`shopping-item ${checked[key] ? 'checked' : ''}`} key={key}><label><input type="checkbox" checked={Boolean(checked[key])} onChange={(event) => setChecked((current) => ({ ...current, [key]: event.target.checked }))}/><span><Icon name="check"/></span><strong>{item.name}</strong></label><span>{Number(item.quantity.toFixed(2))} {item.unit}</span><small>{item.recipeNames.join(', ')}</small><button onClick={() => setPantry((current) => ({ ...current, [key]: true }))}>I have this</button></div>})}</div>})}</section><aside className="pantry-panel"><span className="eyebrow">PANTRY CHECK</span><h2>Already have it?</h2><p>Excluded ingredients stay tucked away until you need them again.</p>{Object.keys(pantry).filter((key) => pantry[key]).length ? <div>{Object.keys(pantry).filter((key) => pantry[key]).map((key) => <button key={key} onClick={() => setPantry((current) => ({ ...current, [key]: false }))}>{key.split('|')[0]} <span>Restore</span></button>)}</div> : <small>No pantry exclusions yet.</small>}</aside></div>}
    </div>
  )
}

export default App

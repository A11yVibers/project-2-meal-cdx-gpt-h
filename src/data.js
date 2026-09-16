import cuisinesCsv from '../project-assets/cuisines.csv?raw'
import dietaryTagsCsv from '../project-assets/dietary_tags.csv?raw'
import ingredientsCsv from '../project-assets/ingredients.csv?raw'
import mealTypesCsv from '../project-assets/meal_types.csv?raw'
import categoriesCsv from '../project-assets/recipe_categories.csv?raw'
import recipeIngredientsCsv from '../project-assets/recipe_ingredients.csv?raw'
import recipeStepsCsv from '../project-assets/recipe_steps.csv?raw'
import recipesCsv from '../project-assets/recipes.csv?raw'
import unitsCsv from '../project-assets/units.csv?raw'

function parseCsv(text) {
  const rows = []
  let row = []
  let field = ''
  let quoted = false

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index]

    if (character === '"') {
      if (quoted && text[index + 1] === '"') {
        field += '"'
        index += 1
      } else {
        quoted = !quoted
      }
    } else if (character === ',' && !quoted) {
      row.push(field)
      field = ''
    } else if ((character === '\n' || character === '\r') && !quoted) {
      if (character === '\r' && text[index + 1] === '\n') index += 1
      row.push(field)
      if (row.some((value) => value !== '')) rows.push(row)
      row = []
      field = ''
    } else {
      field += character
    }
  }

  if (field || row.length) {
    row.push(field)
    rows.push(row)
  }

  const [headers, ...records] = rows
  return records.map((record) => Object.fromEntries(headers.map((header, index) => [header, record[index] ?? ''])))
}

const parseList = (value) => value ? value.split(',').map((item) => item.trim()).filter(Boolean) : []
const numberOrZero = (value) => Number(value) || 0

export const LOOKUPS = {
  cuisines: parseCsv(cuisinesCsv),
  dietaryTags: parseCsv(dietaryTagsCsv),
  ingredients: parseCsv(ingredientsCsv),
  mealTypes: parseCsv(mealTypesCsv),
  categories: parseCsv(categoriesCsv),
  units: parseCsv(unitsCsv),
}

const recipeIngredients = parseCsv(recipeIngredientsCsv)
const recipeSteps = parseCsv(recipeStepsCsv)

export const SEED_RECIPES = parseCsv(recipesCsv).map((recipe) => ({
  id: recipe.recipe_id,
  title: recipe.title,
  description: recipe.short_description,
  sourceName: recipe.source_name,
  sourceUrl: recipe.source_url,
  servings: numberOrZero(recipe.servings),
  prepTime: numberOrZero(recipe.prep_time_minutes),
  cookTime: numberOrZero(recipe.cook_time_minutes),
  totalTime: numberOrZero(recipe.total_time_minutes),
  cuisineId: recipe.cuisine_id,
  mealTypeId: recipe.meal_type_id,
  dietaryTagIds: parseList(recipe.dietary_tag_ids),
  categoryIds: parseList(recipe.category_ids),
  difficulty: numberOrZero(recipe.difficulty_1_to_5),
  spiceLevel: numberOrZero(recipe.spice_level_0_to_5),
  accentColor: recipe.accent_color,
  coverImageUrl: recipe.cover_image_url,
  includeInSuggestions: recipe.include_in_meal_suggestions.toLowerCase() === 'true',
  includeInShoppingList: true,
  showNutrition: false,
  allowSubstitutions: true,
  measurementSystem: 'us',
  ingredients: recipeIngredients
    .filter((item) => item.recipe_id === recipe.recipe_id)
    .map((item) => ({
      id: `${item.recipe_id}-${item.display_order}`,
      sectionName: item.section_name,
      ingredientId: item.ingredient_id,
      ingredientName: item.ingredient_name,
      quantity: item.quantity,
      unit: item.unit,
      notes: item.notes,
      optional: item.optional.toLowerCase() === 'true',
    })),
  steps: recipeSteps
    .filter((step) => step.recipe_id === recipe.recipe_id)
    .map((step) => ({
      id: `${step.recipe_id}-step-${step.step_number}`,
      instruction: step.instruction,
      timerMinutes: numberOrZero(step.timer_minutes),
    })),
  isSeed: true,
}))

export function lookupName(collection, id, idKey, nameKey) {
  return collection.find((item) => item[idKey] === id)?.[nameKey] ?? ''
}

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { RECIPES } from '../data/recipes';
import type { Recipe } from '../types';

import { normalizeShoppingState, type ShoppingListState } from './shoppingState';

interface ShoppingListContextValue {
  recipes: Recipe[];
  recipeSlugs: string[];
  checked: Record<string, boolean>;
  quantities: Record<string, string>;
  setQuantity: (key: string, value: string) => void;
  storageError: boolean;
  isInList: (slug: string) => boolean;
  addRecipe: (slug: string) => void;
  removeRecipe: (slug: string) => void;
  toggleRecipe: (slug: string) => void;
  toggleChecked: (key: string) => void;
  clearChecked: () => void;
  clearAll: () => void;
  count: number;
}

const STORAGE_KEY = 'recipeweb.shoppingList.v1';

function loadState(): ShoppingListState {
  try {
    return normalizeShoppingState(JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? 'null'), RECIPES);
  } catch { return normalizeShoppingState(null, RECIPES); }
}

const ShoppingListContext = createContext<ShoppingListContextValue | null>(null);

export function ShoppingListProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<ShoppingListState>(loadState);
  const [storageError, setStorageError] = useState(false);

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      setStorageError(false);
    } catch {
      setStorageError(true); // Keep the current session usable; disclose persistence failure.
    }
  }, [state]);

  const addRecipe = useCallback((slug: string) => {
    setState((s) =>
      s.recipeSlugs.includes(slug)
        ? s
        : { ...s, recipeSlugs: [...s.recipeSlugs, slug] },
    );
  }, []);

  const removeRecipe = useCallback((slug: string) => {
    setState((s) => ({
      quantities: Object.fromEntries(Object.entries(s.quantities).filter(([key]) => !key.startsWith(`${slug}:`))),
      recipeSlugs: s.recipeSlugs.filter((x) => x !== slug),
      checked: Object.fromEntries(
        Object.entries(s.checked).filter(([k]) => !k.startsWith(`${slug}:`)),
      ),
    }));
  }, []);

  const toggleRecipe = useCallback(
    (slug: string) => {
      setState((s) =>
        s.recipeSlugs.includes(slug)
          ? {
              quantities: Object.fromEntries(Object.entries(s.quantities).filter(([key]) => !key.startsWith(`${slug}:`))),
              recipeSlugs: s.recipeSlugs.filter((x) => x !== slug),
              checked: Object.fromEntries(
                Object.entries(s.checked).filter(
                  ([k]) => !k.startsWith(`${slug}:`),
                ),
              ),
            }
          : { ...s, recipeSlugs: [...s.recipeSlugs, slug] },
      );
    },
    [],
  );

  const toggleChecked = useCallback((key: string) => {
    setState((s) => ({
      ...s,
      checked: { ...s.checked, [key]: !s.checked[key] },
    }));
  }, []);

  const setQuantity = useCallback((key: string, value: string) => {
    if (value.length > 100) return;
    setState((s) => normalizeShoppingState({ ...s, quantities: { ...s.quantities, [key]: value } }, RECIPES));
  }, []);

  const clearChecked = useCallback(() => {
    setState((s) => ({ ...s, checked: {} }));
  }, []);

  const clearAll = useCallback(() => {
    setState({ recipeSlugs: [], checked: {}, quantities: {} });
  }, []);

  const value = useMemo<ShoppingListContextValue>(() => {
    const recipes = state.recipeSlugs
      .map((slug) => RECIPES.find((r) => r.slug === slug))
      .filter((r): r is Recipe => Boolean(r));
    return {
      recipes,
      recipeSlugs: state.recipeSlugs,
      checked: state.checked,
      quantities: state.quantities,
      setQuantity,
      storageError,
      isInList: (slug: string) => state.recipeSlugs.includes(slug),
      addRecipe,
      removeRecipe,
      toggleRecipe,
      toggleChecked,
      clearChecked,
      clearAll,
      count: state.recipeSlugs.length,
    };
  }, [state, setQuantity, storageError, addRecipe, removeRecipe, toggleRecipe, toggleChecked, clearChecked, clearAll]);

  return (
    <ShoppingListContext.Provider value={value}>
      {children}
    </ShoppingListContext.Provider>
  );
}

export function useShoppingList(): ShoppingListContextValue {
  const ctx = useContext(ShoppingListContext);
  if (!ctx) {
    throw new Error('useShoppingList must be used within ShoppingListProvider');
  }
  return ctx;
}

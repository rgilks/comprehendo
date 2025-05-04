import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { createBaseSlice, BaseSlice } from './baseSlice';

describe('baseSlice', () => {
  let store: ReturnType<typeof setupStore>;

  type Store = BaseSlice;
  const setupStore = () =>
    create<Store>()(
      immer((set) => ({
        ...createBaseSlice(set),
      }))
    );

  beforeEach(() => {
    store = setupStore();
  });

  it('should have initial state', () => {
    expect(store.getState().loading).toBe(false);
    expect(store.getState().error).toBeNull();
  });

  it('setLoading updates loading', () => {
    store.getState().setLoading(true);
    expect(store.getState().loading).toBe(true);
    store.getState().setLoading(false);
    expect(store.getState().loading).toBe(false);
  });

  it('setError updates error', () => {
    store.getState().setError('error message');
    expect(store.getState().error).toBe('error message');
    store.getState().setError(null);
    expect(store.getState().error).toBeNull();
  });
});

import { Component, h } from 'preact'
import type { ComponentType, FunctionComponent, VNode } from 'preact'

function shallowEqual(a: Record<string, unknown>, b: Record<string, unknown>): boolean {
  for (const key in a) if (key !== '__source' && !(key in b)) return false
  for (const key in b) if (key !== '__source' && a[key] !== b[key]) return false
  return true
}

/**
 * Skip re-rendering a component whose props are shallowly unchanged.
 *
 * `preact/compat` ships the same helper, but importing it pulls the whole
 * React-compatibility layer into the bundle for the sake of one function.
 */
export function memo<P extends object>(component: FunctionComponent<P>): ComponentType<P> {
  return class Memo extends Component<P> {
    shouldComponentUpdate(next: P): boolean {
      return !shallowEqual(
        this.props as Record<string, unknown>,
        next as Record<string, unknown>,
      )
    }

    render(): VNode {
      return h(component as FunctionComponent<object>, this.props)
    }
  }
}

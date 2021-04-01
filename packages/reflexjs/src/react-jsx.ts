import * as React from "react"
import styleProps from "./style-props"
import { StyleProps, SxProps, Theme } from "./types"
import deepmerge from "deepmerge"
import {
  jsx as themeUIJSX,
  css,
  ThemeUIStyleObject,
  useThemeUI,
  ThemeUIContextValue,
} from "theme-ui"
export {
  ThemeProvider,
  useColorMode,
  css,
  get,
  InitializeColorMode,
} from "theme-ui"

interface ExactContextValue extends Omit<ThemeUIContextValue, "theme"> {
  theme: Theme
}
export const useTheme = (useThemeUI as unknown) as () => ExactContextValue

export const merge = deepmerge

const RESPONSIVE_SEPARATOR = "|"

const regex = new RegExp(`^(${Object.keys(styleProps).join("|")})$`)

const omit = (props) => {
  const next = {}
  for (const key in props) {
    if (regex.test(key)) continue
    next[key] = props[key]
  }
  return next
}

const pick = (props) => {
  const next = {}
  for (const key in props) {
    if (!regex.test(key)) continue
    next[key] = props[key]
  }
  return next
}

const split = (props) => [pick(props), omit(props)]

const makeResponsive = (prop) => {
  if (typeof prop !== "string") {
    return prop
  }

  // Allow responsive values to be written as "foo|bar|baz".
  return prop.split(RESPONSIVE_SEPARATOR).map((value) => {
    if (value === "null") {
      return null
    }
    return value.match(/^\d+$/) ? parseInt(value) : value
  })
}

export function transformProps(
  props: StyleProps,
  result = {}
): ThemeUIStyleObject {
  if (props !== null && typeof props === "object") {
    Object.entries(props).forEach(([key, value]) => {
      if (!Array.isArray(value) && typeof value === "object") {
        return (result[key.replace(/^_/, ":")] = transformProps(value))
      }

      if (typeof styleProps[key] !== "undefined") {
        const names = styleProps[key]
        names.forEach((name) => {
          result[name] = makeResponsive(value)
        })
      }
    })
  }

  return result
}

type doNotParseType = keyof JSX.IntrinsicElements

const doNotParseTypes: doNotParseType[] = ["meta"]

/* eslint-disable  @typescript-eslint/no-explicit-any */
function isDoNotParseType(name: any): name is doNotParseType {
  return doNotParseTypes.includes(name)
}

export function parseProps(type, props) {
  if (!props) return props

  if (isDoNotParseType(type)) {
    return props
  }

  const { variant, sx = {}, ..._props } = props

  // Fix for React.Fragment.
  if (typeof type === "symbol") {
    return props
  }

  if (sx && typeof type !== "string") {
    return {
      ..._props,
      sx: transformProps(sx),
    }
  }

  const [styleProps, otherProps] = split(_props)

  if (
    !variant &&
    Object.keys(sx).length === 0 &&
    Object.keys(styleProps).length === 0
  )
    return props

  const sxProps = transformProps(deepmerge(styleProps, sx))

  const next: typeof props & {
    /* eslint-disable  @typescript-eslint/no-explicit-any */
    css?: any
    sx: SxProps
  } = {
    ...otherProps,
  }

  if (!variant) {
    next.sx = sxProps
    return next
  }

  next.css = (theme) => {
    const variants = variant.split(" ")
    let __themeKeyFailed = false
    let variantStyles = {}
    variants.forEach((variant) => {
      const [__themeKey, ...nestedVariants] = variant.split(".")
      if (!theme[__themeKey]) {
        __themeKeyFailed = true
        return
      }

      // Handle nested variants.
      let styles = theme[__themeKey]
      nestedVariants.forEach((v) => {
        if (theme[__themeKey][v]) {
          const vStyles = theme[__themeKey][v]
          styles = deepmerge(styles, vStyles)
        }
      })

      variantStyles = deepmerge(variantStyles, styles)
    })

    if (__themeKeyFailed) {
      return sxProps ? css(sxProps)(theme) : null
    }

    return css(
      transformProps({
        ...variantStyles,
        ...sxProps,
      })
    )(theme)
  }

  return next
}

export const jsx: typeof React.createElement = (type, props, ...children) => {
  return themeUIJSX.apply(undefined, [
    type,
    parseProps(type, props),
    ...children,
  ])
}

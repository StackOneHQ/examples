import { MouseEvent } from 'react'

// Submit button hover handlers
export const handleSubmitButtonMouseEnter = (e: MouseEvent<HTMLButtonElement>) => {
  const button = e.currentTarget
  button.style.backgroundColor = '#404040'
  button.style.borderColor = '#404040'
}

export const handleSubmitButtonMouseLeave = (e: MouseEvent<HTMLButtonElement>) => {
  const button = e.currentTarget
  button.style.backgroundColor = '#505050'
  button.style.borderColor = '#505050'
}

// Google button hover handlers
export const handleGoogleButtonMouseEnter = (e: MouseEvent<HTMLButtonElement>) => {
  const button = e.currentTarget
  button.style.borderColor = '#d0d0d0'
  button.style.backgroundColor = '#f9f9f9'
}

export const handleGoogleButtonMouseLeave = (e: MouseEvent<HTMLButtonElement>) => {
  const button = e.currentTarget
  button.style.borderColor = '#e0e0e0'
  button.style.backgroundColor = '#ffffff'
}

// Footer link hover handlers
export const handleFooterLinkMouseEnter = (e: MouseEvent<HTMLAnchorElement>) => {
  const link = e.currentTarget
  link.style.color = '#404040'
}

export const handleFooterLinkMouseLeave = (e: MouseEvent<HTMLAnchorElement>) => {
  const link = e.currentTarget
  link.style.color = '#000000'
}

// Additional link hover handlers
export const handleAdditionalLinkMouseEnter = (e: MouseEvent<HTMLAnchorElement>) => {
  const link = e.currentTarget
  link.style.color = '#505050'
}

export const handleAdditionalLinkMouseLeave = (e: MouseEvent<HTMLAnchorElement>) => {
  const link = e.currentTarget
  link.style.color = '#707070'
}
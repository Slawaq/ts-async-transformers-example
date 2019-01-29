import * as React from 'react'
import style from './typography.css'

export const Header1: React.FC = ({ children }) =>
  <span className={style.header1}>{children}</span>

export const Header2: React.FC = ({ children }) =>
  <span className={style.header2}>{children}</span>

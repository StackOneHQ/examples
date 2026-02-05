'use client'

import React, { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { signOut } from 'next-auth/react'
import { sessionManager } from '@/lib/stackone/session-manager'
import { 
  Layout, 
  Menu, 
  Avatar, 
  Dropdown, 
  Space, 
  Typography, 
  Input,
  Divider,
  Button
} from 'antd'
import styles from './StackOneSidebar.module.css'
import Logo from './Logo'
import { 
  LogoutOutlined, 
  SearchOutlined, 
  DashboardOutlined, 
  SettingOutlined, 
  ApiOutlined, 
  RobotOutlined, 
  MenuFoldOutlined, 
  MenuUnfoldOutlined 
} from '@ant-design/icons'
const { Sider } = Layout
const { Search } = Input

export interface SidebarUser {
  id: string
  email?: string | null
  name?: string | null
}

// Create type-asserted components
const TypographySider = Sider as any
const TypographyMenu = Menu as any
const TypographyAvatar = Avatar as any
const TypographyDropdown = Dropdown as any
const TypographySpace = Space as any
const TypographyText = Typography.Text as any
const TypographySearch = Search as any
const TypographyDivider = Divider as any
const TypographyButton = Button as any
const LogoutOutlinedIcon = LogoutOutlined as any
const SearchOutlinedIcon = SearchOutlined as any
const DashboardOutlinedIcon = DashboardOutlined as any
const SettingOutlinedIcon = SettingOutlined as any
const ApiOutlinedIcon = ApiOutlined as any
const RobotOutlinedIcon = RobotOutlined as any
const MenuFoldOutlinedIcon = MenuFoldOutlined as any
const MenuUnfoldOutlinedIcon = MenuUnfoldOutlined as any

interface StackOneSidebarProps {
  user: SidebarUser
  collapsed?: boolean
  onCollapse?: (collapsed: boolean) => void
}

export default function StackOneSidebar({ user, collapsed: externalCollapsed, onCollapse }: StackOneSidebarProps) {
  const pathname = usePathname()
  const router = useRouter()
  const [internalCollapsed, setInternalCollapsed] = useState(false)
  const [isMobile, setIsMobile] = useState(false)

  // Use external collapsed state if provided, otherwise use internal state
  const collapsed = externalCollapsed !== undefined ? externalCollapsed : internalCollapsed

  // Check if screen is mobile size
  useEffect(() => {
    const checkIsMobile = () => {
      setIsMobile(window.innerWidth < 768)
    }
    
    checkIsMobile()
    window.addEventListener('resize', checkIsMobile)
    return () => window.removeEventListener('resize', checkIsMobile)
  }, [])

  // Default to collapsed on mobile screens
  useEffect(() => {
    if (isMobile && externalCollapsed === undefined) {
      setInternalCollapsed(true)
    }
  }, [isMobile, externalCollapsed])

  const handleCollapse = (newCollapsed: boolean) => {
    if (onCollapse) {
      onCollapse(newCollapsed)
    } else {
      setInternalCollapsed(newCollapsed)
    }
  }

  const handleLogout = async () => {
    try {
      sessionManager.clearAllSessions()
      await signOut({ callbackUrl: '/login' })
    } catch (error) {
      console.error('Logout error:', error)
    }
  }

  const userMenuItems = [
    {
      key: 'logout',
      label: 'Logout',
      icon: <LogoutOutlinedIcon />,
      onClick: handleLogout,
    },
  ]

  const mainMenuItems = [
    { 
      key: '/dashboard', 
      label: 'Dashboard', 
      icon: <DashboardOutlinedIcon />,
      url: '/dashboard'
    },
    { 
      key: '/integrations', 
      label: 'Integrations', 
      icon: <ApiOutlinedIcon />,
      url: '/integrations'
    },
    { 
      key: '/agents', 
      label: 'Agents', 
      icon: <RobotOutlinedIcon />,
      url: '/agents'
    },
  ]

  const allMenuItems = mainMenuItems

  const handleMenuClick = ({ key }: { key: string }) => {
    const item = allMenuItems.find(item => item.key === key)
    if (item) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if ((item as any).external) {
        window.open(item.url, '_blank')
      } else {
        router.push(item.url)
      }
    }
  }

  return (
    <TypographySider
      width={collapsed ? 80 : 280}
      collapsed={collapsed}
      collapsible
      trigger={null}
      className={styles.sidebar}
      style={{
        height: '100vh',
        position: 'fixed',
        left: 0,
        top: 0,
        zIndex: 1000,
        overflow: 'auto',
        transition: 'width 0.2s ease',
      }}
    >
      <div className={collapsed ? styles.sidebarContentCollapsed : styles.sidebarContent}>
        
        <div className={collapsed ? styles.headerSectionCollapsed : styles.headerSection}>

          {/* Logo Section - Hidden when collapsed */}
          {!collapsed && (
            <div className={styles.logoSection}>
            <Link href="/" className={styles.logoLink}>
              <TypographySpace align="center" size="middle">
                <Logo width={24} alt="StackOne Logo" />
                {!collapsed && (
                  <div>
                    <TypographyText className={styles.logoText}>
                      Context-Aware Agent Playground
                    </TypographyText>
                  </div>
                )}
              </TypographySpace>
            </Link>
            </div>
          )}

          {/* Toggle Button */}
          <TypographyButton
            type="text"
            icon={collapsed ? <MenuUnfoldOutlinedIcon /> : <MenuFoldOutlinedIcon />}
            onClick={() => handleCollapse(!collapsed)}
            className={styles.collapseButton}
          />

        </div>

        <TypographyDivider className={styles.divider} />

        {/* Search Section - Hidden when collapsed */}
        {!collapsed && (
          <div className={styles.searchSection}>
            <TypographySearch
              placeholder="Search"
              allowClear
              className={styles.searchInput}
              prefix={<SearchOutlinedIcon className={styles.searchIcon} />}
            />
          </div>
        )}

        {/* Navigation Menu */}
        <div className={styles.menuContainer}>
          <TypographyMenu
            mode="inline"
            selectedKeys={[pathname]}
            items={mainMenuItems}
            className={styles.mainMenu}
            onClick={handleMenuClick}
            inlineCollapsed={collapsed}
          />
        </div>

        <TypographyDivider className={styles.userDivider} />

        {/* User Profile Section */}
        <div className={styles.userSection}>
          <TypographyDropdown
            menu={{ items: userMenuItems }}
            placement="topRight"
            arrow
          >
            <div 
              className={`${styles.userProfileTrigger} ${collapsed ? styles.userProfileTriggerCollapsed : ''}`}
            >
              <TypographyAvatar
                size="small"
                className={`${styles.userAvatar} ${collapsed ? styles.userAvatarCollapsed : ''}`}
              >
                {user.email?.charAt(0).toUpperCase()}
              </TypographyAvatar>
              {!collapsed && (
                <div className={styles.userInfo}>
                  <TypographyText className={styles.userEmail}>
                    {user.email}
                  </TypographyText>
                </div>
              )}
              {!collapsed && <SettingOutlinedIcon className={styles.settingsIcon} />}
            </div>
          </TypographyDropdown>
        </div>
      </div>
    </TypographySider>
  )
}

'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { FilePicker } from '@stackone/file-picker'
import { File } from '@stackone/file-picker'
import { sessionManager } from '@/lib/stackone/session-manager'
import { logger } from '@/utils/logger'
import { Button, Card, Space, Typography, Tag, Tooltip } from 'antd'
import { 
  FileTextOutlined, 
  FilePdfOutlined, 
  FileExcelOutlined, 
  FileWordOutlined, 
  FileImageOutlined,
  FileOutlined,
  DeleteOutlined,
  PlusOutlined
} from '@ant-design/icons'
import type { Integration } from '@/types'
import styles from './StackOneFilePicker.module.css'

const { Text } = Typography

interface SelectedFile {
  id: string
  name: string
  mimeType?: string
  size?: number
  url?: string
}

interface StackOneFilePickerProps {
  isOpen?: boolean
  onClose?: () => void
  onSuccess: (fileIds: string[], files?: SelectedFile[]) => void
  integrationId: string
  multiple?: boolean
  selectedFileIds?: string[]
  selectedFiles?: SelectedFile[]
  inline?: boolean // New prop to render inline instead of modal
  onDone?: () => void // Callback for when Done button is clicked in inline mode
  stackoneOnly?: boolean // New prop to only show StackOne picker without our modal wrapper
}

export function StackOneFilePicker({ 
  isOpen = true, 
  onClose, 
  onSuccess, 
  integrationId,
  multiple = true,
  selectedFileIds = [],
  selectedFiles = [],
  inline = false,
  onDone,
  stackoneOnly = false
}: StackOneFilePickerProps) {
  const [loading, setLoading] = useState(false)
  const [filePicker, setFilePicker] = useState<FilePicker | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [integration, setIntegration] = useState<Integration | null>(null)
  const [currentSelectedFiles, setCurrentSelectedFiles] = useState<SelectedFile[]>([])
  const [filesInitialized, setFilesInitialized] = useState(false)
  const supabase = createClient()

  // Get file type icon based on MIME type or file extension
  const getFileTypeIcon = (file: SelectedFile) => {
    const fileName = file.name.toLowerCase()
    
    if (fileName.endsWith('.pdf')) {
      return <FilePdfOutlined className={styles.fileIconPdf} />
    } else if (fileName.endsWith('.doc') || fileName.endsWith('.docx')) {
      return <FileWordOutlined className={styles.fileIconWord} />
    } else if (fileName.endsWith('.xls') || fileName.endsWith('.xlsx')) {
      return <FileExcelOutlined className={styles.fileIconExcel} />
    } else if (/\.(jpg|jpeg|png|gif|bmp|webp)$/i.test(fileName)) {
      return <FileImageOutlined className={styles.fileIconImage} />
    } else if (fileName.endsWith('.txt')) {
      return <FileTextOutlined className={styles.fileIconText} />
    } else {
      return <FileOutlined className={styles.fileIconDefault} />
    }
  }

  // Get file type label
  const getFileTypeLabel = (file: SelectedFile) => {
    const fileName = file.name.toLowerCase()
    
    if (fileName.endsWith('.pdf')) return 'PDF'
    if (fileName.endsWith('.doc') || fileName.endsWith('.docx')) return 'Word'
    if (fileName.endsWith('.xls') || fileName.endsWith('.xlsx')) return 'Excel'
    if (/\.(jpg|jpeg|png|gif|bmp|webp)$/i.test(fileName)) return 'Image'
    if (fileName.endsWith('.txt')) return 'Text'
    return 'File'
  }

  // Format file size
  const formatFileSize = (bytes?: number) => {
    if (!bytes) return ''
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(1024))
    return `${Math.round(bytes / Math.pow(1024, i) * 100) / 100} ${sizes[i]}`
  }

  // Initialize selected files when modal opens (only once)
  useEffect(() => {
    if ((isOpen || inline) && !filesInitialized) {
      if (selectedFiles.length > 0) {
        // Use the provided selectedFiles if available
        setCurrentSelectedFiles(selectedFiles)
      } else if (selectedFileIds.length > 0) {
        // Fallback to selectedFileIds with placeholder names
        const initialFiles: SelectedFile[] = selectedFileIds.map(id => ({
          id,
          name: `File ${id.slice(0, 8)}...` // Placeholder name
        }))
        setCurrentSelectedFiles(initialFiles)
      } else {
        // Reset to empty array if no files are selected
        setCurrentSelectedFiles([])
      }
      setFilesInitialized(true)
    } else if (!isOpen && !inline) {
      // Reset initialization flag when modal closes
      setFilesInitialized(false)
    }
  }, [isOpen, inline, selectedFiles, selectedFileIds, filesInitialized])

  useEffect(() => {
    if (!isOpen && !inline) return

    const loadIntegration = async () => {
      try {
        const { data, error } = await supabase
          .from('integrations')
          .select('*')
          .eq('id', integrationId)
          .single()

        if (error) throw error
        setIntegration(data)
      } catch (error) {
        logger.error('Error loading integration:', error)
        setError('Failed to load integration')
        onClose()
      }
    }

    loadIntegration()
  }, [isOpen, integrationId, onClose, supabase])

  useEffect(() => {
    if (!integration || (!isOpen && !inline)) return

    const initializeAndOpenPicker = async () => {
      try {
        setLoading(true)
        setError(null)

        // Get current user from Supabase
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) {
          throw new Error('User not authenticated')
        }

        // Get or create a valid session token using the session manager
        const sessionToken = await sessionManager.getValidToken(
          integration.id,
          integration.provider,
          integration.stackone_account_id,
          multiple
        )

        // Initialize file picker
        const picker = new FilePicker({
          sessionToken,
          containerId: 'file-picker-container',
          showBranding: false,
          folderSelectionEnabled: false,
          driveSelectionEnabled: false,
          onFilesPicked: (data) => {
            logger.log('StackOneFilePicker: onFilesPicked called with:', data)
            // Convert StackOne File objects to our SelectedFile format
            const newFiles: SelectedFile[] = data.files.map((file) => ({
              id: file.id,
              name: file.name || 'Unknown file'
            }))
            logger.log('StackOneFilePicker: converted files:', newFiles)

            // Add new files to existing selection (avoiding duplicates)
            const existingIds = new Set(currentSelectedFiles.map(f => f.id))
            const uniqueNewFiles = newFiles.filter(f => !existingIds.has(f.id))
            logger.log('StackOneFilePicker: unique new files:', uniqueNewFiles)
            
            const updatedFiles = [...currentSelectedFiles, ...uniqueNewFiles]
            logger.log('StackOneFilePicker: updated files:', updatedFiles)
            setCurrentSelectedFiles(updatedFiles)
            
            // In stackoneOnly mode, immediately call success callback with the files
            if (stackoneOnly) {
              logger.log('StackOneFilePicker: stackoneOnly mode - calling success immediately')
              const fileIds = updatedFiles.map(file => file.id)
              onSuccess(fileIds, updatedFiles)
              if (onClose) onClose()
            }
          },
          onOpen: () => {
            logger.log('File picker opened')
            const container = document.getElementById('file-picker-container')
            if (container) {
              container.style.display = 'block'
            }
          },
          onClose: () => {
            logger.log('File picker closed')
            // In stackoneOnly mode, files are already handled in onFilesPicked
            if (!stackoneOnly) {
              // Don't close the modal, just hide the file picker
              const container = document.getElementById('file-picker-container')
              if (container) {
                container.style.display = 'none'
              }
            }
          },
          onCancel: () => {
            logger.log('File selection canceled')
            // In stackoneOnly mode, close without confirming
            if (stackoneOnly) {
              if (onClose) onClose()
            } else {
              // Don't close the modal, just hide the file picker
              const container = document.getElementById('file-picker-container')
              if (container) {
                container.style.display = 'none'
              }
            }
          },
          onError: (error: Error) => {
            logger.error('File picker error:', error)
            setError('File picker error occurred')
            onClose()
          }
        })

        setFilePicker(picker)
        
        // Auto-open the file picker in stackoneOnly mode
        if (stackoneOnly) {
          setTimeout(() => {
            const container = document.getElementById('file-picker-container')
            if (container) {
              container.style.display = 'block'
            }
            picker.open()
          }, 100)
        }
      } catch (error) {
        logger.error('Error initializing file picker:', error)
        setError('Failed to initialize file picker')
        onClose()
      } finally {
        setLoading(false)
      }
    }

    initializeAndOpenPicker()
  }, [integration, isOpen, multiple, onClose, supabase, stackoneOnly])

  const handleRemoveFile = (fileId: string) => {
    setCurrentSelectedFiles(prev => prev.filter(file => file.id !== fileId))
  }

  const handleConfirmSelection = () => {
    const fileIds = currentSelectedFiles.map(file => file.id)
    logger.log('StackOneFilePicker: handleConfirmSelection called with:', { fileIds, currentSelectedFiles })
    onSuccess(fileIds, currentSelectedFiles)
    if (inline && onDone) {
      onDone()
    } else if (onClose) {
      onClose()
    }
  }

  const handleOpenPicker = () => {
    if (filePicker) {
      // Show the container before opening the picker
      const container = document.getElementById('file-picker-container')
      if (container) {
        container.style.display = 'block'
      }
      filePicker.open()
    }
  }

  if (!isOpen && !inline && !stackoneOnly) return null

  // For stackoneOnly mode, just render the file picker container and trigger it
  if (stackoneOnly) {
    return (
      <div 
        id="file-picker-container" 
        className={styles.filePickerContainer}
      />
    )
  }

  // For inline mode, render just the Card without modal wrapper
  if (inline) {
    return (
      <Card
        title="Select Files"
        className={styles.inlineCard}
      >
        <Space direction="vertical" className={styles.spaceContainer}>
          {/* Add Files Button */}
          <div className={styles.addFilesButtonContainer}>
            <Button
              type="default"
              size="large"
              icon={<PlusOutlined />}
              onClick={handleOpenPicker}
              loading={loading}
              className={styles.addFilesButtonInline}
            >
              {loading ? 'Opening File Picker...' : 'Add Files'}
            </Button>
          </div>

          {/* Selected Files Display */}
          {currentSelectedFiles.length > 0 && (
            <div>
              <Text strong className={styles.selectedFilesSection}>
                Selected Files ({currentSelectedFiles.length})
              </Text>
              <div className={styles.filesGrid}>
                {currentSelectedFiles.map((file) => (
                  <Card
                    key={file.id}
                    size="small"
                    className={styles.fileCardInline}
                    bodyStyle={{ padding: '12px' }}
                  >
                    <div className={styles.fileItemInline}>
                      <div className={styles.fileIconContainer}>
                        {getFileTypeIcon(file)}
                      </div>
                      <div className={styles.fileContentInline}>
                        <Tooltip title={file.name}>
                          <Text 
                            strong 
                            className={styles.fileNameInline}
                          >
                            {file.name}
                          </Text>
                        </Tooltip>
                        <div className={styles.fileMetadata}>
                          <Tag color="blue">
                            {getFileTypeLabel(file)}
                          </Tag>
                          {file.size && (
                            <Text type="secondary" className={styles.fileSize}>
                              {formatFileSize(file.size)}
                            </Text>
                          )}
                        </div>
                      </div>
                      <Button
                        type="text"
                        size="small"
                        icon={<DeleteOutlined />}
                        onClick={() => handleRemoveFile(file.id)}
                        className={styles.deleteButton}
                      />
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {/* Error Display */}
          {error && (
            <div className={styles.errorDisplay}>
              {error}
            </div>
          )}
        </Space>

        {/* Done Button for Inline Mode */}
        {inline && (
          <div className={styles.doneButtonContainer}>
            <Button 
              type="default" 
              onClick={handleConfirmSelection}
              disabled={currentSelectedFiles.length === 0}
              className={styles.doneButton}
            >
              Done ({currentSelectedFiles.length} files selected)
            </Button>
          </div>
        )}

        {/* File Picker Container */}
        <div 
          id="file-picker-container" 
          className={styles.filePickerContainer}
        />
      </Card>
    )
  }

  // Modal mode
  return (
    <div className={styles.modalOverlay}>
      <Card
        title="Select Files"
        className={styles.modalCard}
        extra={onClose ? (
          <Space>
            <Button 
              onClick={onClose}
              className={styles.cancelButton}
            >
              Cancel
            </Button>
            <Button 
              type="default" 
              onClick={handleConfirmSelection}
              disabled={currentSelectedFiles.length === 0}
              className={styles.confirmButton}
            >
              Confirm Selection ({currentSelectedFiles.length})
            </Button>
          </Space>
        ) : undefined}
      >
        <Space direction="vertical" className={styles.spaceContainer}>
          {/* Add Files Button */}
          <div className={styles.addFilesButtonContainer}>
            <Button
              type="default"
              size="large"
              icon={<PlusOutlined />}
              onClick={handleOpenPicker}
              loading={loading}
              className={styles.addFilesButtonModal}
            >
              {loading ? 'Loading...' : 'Add Files'}
            </Button>
          </div>

          {/* Selected Files Display */}
          {currentSelectedFiles.length > 0 && (
            <div>
              <Text strong className={styles.selectedFilesSectionModal}>
                Selected Files ({currentSelectedFiles.length})
              </Text>
              <div className={styles.filesList}>
                {currentSelectedFiles.map((file, index) => (
                  <Card
                    key={file.id || index}
                    size="small"
                    className={styles.fileCardModal}
                  >
                    <div className={styles.fileItemModal}>
                      <div className={styles.fileContentModal}>
                        {getFileTypeIcon(file)}
                        <div className={styles.fileDetailsModal}>
                          <Text 
                            strong 
                            className={styles.fileNameModal}
                          >
                            {file.name}
                          </Text>
                          <Tooltip title={file.mimeType || 'Unknown type'}>
                            <div className={styles.fileMetadata}>
                              <Tag color="blue">
                                {getFileTypeLabel(file)}
                              </Tag>
                              {file.size && (
                                <Text type="secondary" className={styles.fileSize}>
                                  {formatFileSize(file.size)}
                                </Text>
                              )}
                            </div>
                          </Tooltip>
                        </div>
                      </div>
                      <Button
                        type="text"
                        size="small"
                        icon={<DeleteOutlined />}
                        onClick={() => handleRemoveFile(file.id)}
                        className={styles.deleteButton}
                      />
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {/* Error Display */}
          {error && (
            <div className={styles.errorDisplay}>
              {error}
            </div>
          )}
        </Space>

        {/* File Picker Container */}
        <div 
          id="file-picker-container" 
          className={styles.filePickerContainer}
        />
      </Card>
    </div>
  )
}

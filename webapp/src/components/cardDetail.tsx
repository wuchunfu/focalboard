// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
import React from 'react'
import {FormattedMessage, IntlShape, injectIntl} from 'react-intl'

import {BlockIcons} from '../blockIcons'
import {MutableCommentBlock} from '../blocks/commentBlock'
import {MutableTextBlock} from '../blocks/textBlock'
import {BoardTree} from '../viewModel/boardTree'
import {CardTree, MutableCardTree} from '../viewModel/cardTree'
import mutator from '../mutator'
import {OctoListener} from '../octoListener'
import {OctoUtils} from '../octoUtils'
import {PropertyMenu} from '../propertyMenu'
import {Utils} from '../utils'

import MenuWrapper from '../widgets/menuWrapper'
import Menu from '../widgets/menu'

import Button from './button'
import {Editable} from './editable'
import {MarkdownEditor} from './markdownEditor'
import ContentBlock from './contentBlock'
import CommentsList from './commentsList'

import './cardDetail.scss'

type Props = {
    boardTree: BoardTree
    cardId: string
    intl: IntlShape
}

type State = {
    cardTree?: CardTree
}

class CardDetail extends React.Component<Props, State> {
    private titleRef = React.createRef<Editable>()
    private cardListener?: OctoListener

    shouldComponentUpdate() {
        return true
    }

    constructor(props: Props) {
        super(props)
        this.state = {}
    }

    componentDidMount() {
        this.cardListener = new OctoListener()
        this.cardListener.open([this.props.cardId], async (blockId) => {
            Utils.log(`cardListener.onChanged: ${blockId}`)
            await cardTree.sync()
            this.setState({...this.state, cardTree})
        })
        const cardTree = new MutableCardTree(this.props.cardId)
        cardTree.sync().then(() => {
            this.setState({...this.state, cardTree})
            setTimeout(() => {
                if (this.titleRef.current) {
                    this.titleRef.current.focus()
                }
            }, 0)
        })
    }

    componentWillUnmount() {
        this.cardListener?.close()
        this.cardListener = undefined
    }

    render() {
        const {boardTree, intl} = this.props
        const {cardTree} = this.state
        const {board} = boardTree
        if (!cardTree) {
            return null
        }
        const {card, comments} = cardTree

        const newCommentRef = React.createRef<Editable>()
        const sendCommentButtonRef = React.createRef<HTMLDivElement>()
        let contentElements
        if (cardTree.contents.length > 0) {
            contentElements =
                (<div className='octo-content'>
                    {cardTree.contents.map((block) => (
                        <ContentBlock
                            key={block.id}
                            block={block}
                            cardId={card.id}
                            cardTree={cardTree}
                        />
                    ))}
                </div>)
        } else {
            contentElements = (<div className='octo-content'>
                <div className='octo-block octo-hover-container'>
                    <div className='octo-block-margin'/>
                    <MarkdownEditor
                        text=''
                        placeholderText='Add a description...'
                        onChanged={(text) => {
                            const block = new MutableTextBlock()
                            block.parentId = card.id
                            block.title = text
                            block.order = cardTree.contents.length * 1000
                            mutator.insertBlock(block, 'add card text')
                        }}
                    />
                </div>
            </div>)
        }

        const icon = card.icon

        return (
            <>
                <div className='CardDetail content'>
                    {icon &&
                        <MenuWrapper>
                            <div className='octo-button octo-icon octo-card-icon'>{icon}</div>
                            <Menu>
                                <Menu.Text
                                    id='random'
                                    name={intl.formatMessage({id: 'CardDetail.random-icon', defaultMessage: 'Random'})}
                                    onClick={() => mutator.changeIcon(card, BlockIcons.shared.randomIcon())}
                                />
                                <Menu.Text
                                    id='remove'
                                    name={intl.formatMessage({id: 'CardDetail.remove-icon', defaultMessage: 'Remove Icon'})}
                                    onClick={() => mutator.changeIcon(card, undefined, 'remove icon')}
                                />
                            </Menu>
                        </MenuWrapper>}
                    {!icon &&
                        <div className='octo-hovercontrols'>
                            <Button
                                onClick={() => {
                                    const newIcon = BlockIcons.shared.randomIcon()
                                    mutator.changeIcon(card, newIcon)
                            }}>
                                <FormattedMessage
                                    id='CardDetail.add-icon'
                                    defaultMessage='Add Icon'
                                />
                            </Button>
                        </div>}

                    <Editable
                        ref={this.titleRef}
                        className='title'
                        text={card.title}
                        placeholderText='Untitled'
                        onChanged={(text) => {
                            mutator.changeTitle(card, text)
                        }}
                    />

                    {/* Property list */}

                    <div className='octo-propertylist'>
                        {board.cardProperties.map((propertyTemplate) => {
                            return (
                                <div
                                    key={propertyTemplate.id}
                                    className='octo-propertyrow'
                                >
                                    <div
                                        className='octo-button octo-propertyname'
                                        onClick={(e) => {
                                            const menu = PropertyMenu.shared
                                            menu.property = propertyTemplate
                                            menu.onNameChanged = (propertyName) => {
                                                Utils.log('menu.onNameChanged')
                                                mutator.renameProperty(board, propertyTemplate.id, propertyName)
                                            }

                                            menu.onMenuClicked = async (command) => {
                                                switch (command) {
                                                case 'type-text':
                                                    await mutator.changePropertyType(board, propertyTemplate, 'text')
                                                    break
                                                case 'type-number':
                                                    await mutator.changePropertyType(board, propertyTemplate, 'number')
                                                    break
                                                case 'type-createdTime':
                                                    await mutator.changePropertyType(board, propertyTemplate, 'createdTime')
                                                    break
                                                case 'type-updatedTime':
                                                    await mutator.changePropertyType(board, propertyTemplate, 'updatedTime')
                                                    break
                                                case 'type-select':
                                                    await mutator.changePropertyType(board, propertyTemplate, 'select')
                                                    break
                                                case 'delete':
                                                    await mutator.deleteProperty(boardTree, propertyTemplate.id)
                                                    break
                                                default:
                                                    Utils.assertFailure(`Unhandled menu id: ${command}`)
                                                }
                                            }
                                            menu.showAtElement(e.target as HTMLElement)
                                        }}
                                    >{propertyTemplate.name}</div>
                                    {OctoUtils.propertyValueEditableElement(card, propertyTemplate)}
                                </div>
                            )
                        })}

                        <div
                            className='octo-button octo-propertyname add-property'
                            onClick={async () => {
                                // TODO: Show UI
                                await mutator.insertPropertyTemplate(boardTree)
                            }}
                        >
                            <FormattedMessage
                                id='CardDetail.add-property'
                                defaultMessage='+ Add a property'
                            />
                        </div>
                    </div>

                    {/* Comments */}

                    <hr/>
                        <CommentsList
                            comments={comments}
                            cardId={card.id}
                        />
                    <hr/>
                </div>

                {/* Content blocks */}

                <div className='CardDetail content fullwidth'>
                    {contentElements}
                </div>

                <div className='CardDetail content'>
                    <div className='octo-hoverpanel octo-hover-container'>
                        <MenuWrapper>
                            <div className='octo-button octo-hovercontrol octo-hover-item'>
                                <FormattedMessage
                                    id='CardDetail.add-content'
                                    defaultMessage='Add content'
                                />
                            </div>
                            <Menu>
                                <Menu.Text
                                    id='text'
                                    name={intl.formatMessage({id: 'CardDetail.text', defaultMessage: 'Text'})}
                                    onClick={() => {
                                        const block = new MutableTextBlock()
                                        block.parentId = card.id
                                        block.order = cardTree.contents.length * 1000
                                        mutator.insertBlock(block, 'add text')
                                    }}
                                />
                                <Menu.Text
                                    id='image'
                                    name={intl.formatMessage({id: 'CardDetail.image', defaultMessage: 'Image'})}
                                    onClick={() => Utils.selectLocalFile(
                                        (file) => mutator.createImageBlock(card.id, file, cardTree.contents.length * 1000),
                                        '.jpg,.jpeg,.png',
                                    )}
                                />

                            </Menu>
                        </MenuWrapper>
                    </div>
                </div>
            </>
        )
    }

    close() {
        PropertyMenu.shared.hide()
    }
}

export default injectIntl(CardDetail)

import State from '../@types/State'
import alert from '../reducers/alert'
import moveThought from '../reducers/moveThought'
import findDescendant from '../selectors/findDescendant'
import { anyChild } from '../selectors/getChildren'
import getRankAfter from '../selectors/getRankAfter'
import isContextViewActive from '../selectors/isContextViewActive'
import simplifyPath from '../selectors/simplifyPath'
import appendToPath from '../util/appendToPath'
import ellipsize from '../util/ellipsize'
import head from '../util/head'
import headValue from '../util/headValue'
import isEM from '../util/isEM'
import isRoot from '../util/isRoot'
import parentOf from '../util/parentOf'
import reducerFlow from '../util/reducerFlow'
import deleteThought from './deleteThought'
import newThought from './newThought'
import setCursor from './setCursor'

/** Increases the indentation level of the thought, i.e. Moves it to the end of its previous sibling. */
const thoughtToNote = (state: State) => {
  const { cursor } = state

  if (!cursor) return state

  const thoughtId = head(cursor)
  const noteId = findDescendant(state, thoughtId, '=note')

  // cancel if cursor is the em or home contexts
  if (isEM(cursor) || isRoot(cursor)) {
    return alert(state, { value: `The "${isEM(cursor) ? 'em' : 'home'}" context cannot be converted to a note.` })
  }
  // cancel if cursor is in the home context
  if (!noteId && cursor.length < 2) {
    return alert(state, { value: `Thoughts in the home context cannot be converted to a note.` })
  }
  // cancel if parent is readonly or unextendable
  else if (findDescendant(state, head(parentOf(cursor)), '=readonly')) {
    return alert(state, {
      value: `"${ellipsize(headValue(state, parentOf(cursor)))}" is read-only so "${headValue(
        state,
        cursor,
      )}" cannot be converted to a note.`,
    })
  } else if (findDescendant(state, head(parentOf(cursor)), '=uneditable')) {
    return alert(state, {
      value: `"${ellipsize(headValue(state, parentOf(cursor)))}" is unextendable so "${headValue(
        state,
        cursor,
      )}" cannot be converted to a note.`,
    })
  } else if (isContextViewActive(state, parentOf(cursor))) {
    return alert(state, {
      value: `A context in the context view cannot be converted to a note.`,
    })
  }

  return reducerFlow(
    noteId
      ? // note to thought
        [
          // move =note's child to the parent
          state => {
            const noteChildId = anyChild(state, noteId)!.id
            const simplePath = simplifyPath(state, cursor)
            const oldPath = appendToPath(cursor, noteId, noteChildId)
            const newPath = appendToPath(cursor, noteChildId)
            const newRank = getRankAfter(state, appendToPath(simplePath, noteId))
            return reducerFlow([
              moveThought({ oldPath, newPath, newRank }),
              // delete =note
              deleteThought({
                pathParent: cursor,
                thoughtId: noteId,
              }),
              setCursor({ path: newPath }),
            ])(state)
          },
        ]
      : // thought to note
        [
          // create =note in the parent
          newThought({
            at: parentOf(cursor),
            insertBefore: true,
            insertNewSubthought: true,
            preventSetCursor: true,
            value: '=note',
          }),
          // move the cursor into =note
          state => {
            return moveThought(state, {
              oldPath: cursor,
              newPath: appendToPath(
                parentOf(cursor),
                findDescendant(state, head(parentOf(cursor)), '=note')!,
                thoughtId,
              ),
              newRank: 0,
            })
          },
          setCursor({ path: parentOf(cursor) }),
        ],
  )(state)
}

export default thoughtToNote
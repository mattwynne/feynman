'use strict'

const sentenceCase = require('sentence-case')

/*
 * Actor - attempts actions using its abilities, it knows how to perform
 *         actions in its context
 * Ability - dependencies that the interaction needs to do its work
 *           example: browser, the domain api
 *           options: capability, tool, faculty, dependency
 * Perspective - a group of Interactions that use a particular set of Abilities
 * Action - is a general term for task or interaction
 * Task - tasks are composed of tasks or interactions
 * Interaction - directly uses abilities to do something to the app
 */

/*
 * Annoyances
 *
 * - there's two if statements
 */

const Actor = (abilities = {}, perspective = Perspective('unknown')) => {
  const actor = {
    attemptsTo: async (...actions) => {
      for (const action of actions) {
        const handler = perspective.handlerFor(action)
        await handler({ actor, ...abilities })
      }
      return actor
    },
    asks: async question => {
      const handler = perspective.handlerFor(question)
      return handler({ actor, ...abilities })
    },
    through: newPerspective => Actor(abilities, newPerspective),
    gainsAbilities: extraAbilities => {
      Object.assign(abilities, extraAbilities)
      return actor
    },
    perspective,
  }
  return actor
}

const Task = (id, args, fn) => {
  const description = sentenceCase(id)
  const nestedTasks = []
  const task = (..._params) => {
    const params = _params.reduce(
      (params, param, index) => ({ [args[index]]: param, ...params }),
      {}
    )
    const actionDescription = [description]
      .concat(Object.values(params).map(value => `'${value}'`))
      .join(' ')
    const action = {
      id,
      params,
      description: actionDescription,
    }
    nestedTasks.forEach(NestedTask => {
      const nestedTaskName = NestedTask.id.split('.').pop()
      action[nestedTaskName] = (...args) => {
        const nestedAction = NestedTask(...args)
        nestedAction.description = [actionDescription]
          .concat(sentenceCase(nestedTaskName).toLowerCase())
          .concat(Object.values(nestedAction.params).map(value => `'${value}'`))
          .join(' ')
        nestedAction.params = { ...action.params, ...nestedAction.params }
        return nestedAction
      }
      action[nestedTaskName].id = NestedTask.id
      action[nestedTaskName].description = NestedTask.description
    })
    return action
  }
  task.id = id
  task.description = description

  if (fn) {
    fn((id, _args, fn) => {
      const NestedTask = Task(`${task.id}.${id}`, { ...args, ..._args }, fn)
      task[id] = NestedTask
      nestedTasks.push(NestedTask)
    })
  }

  return task
}

const Perspective = (name, definition) => {
  const handlers = {}
  const perspective = {
    handlerFor: action => {
      if (!action.hasOwnProperty('id')) return action
      const { id, params = {} } = action
      if (!handlers.hasOwnProperty(id))
        throw new Error(
          `No handler found for task "${
            action.id
          }" in "${name}" perspective.\n\nAlternatives:\n${Object.keys(
            handlers
          ).join('\n')}`
        )
      return handlers[id](params)
    },
    name: name,
  }
  const registerHandler = (action, fn) => {
    handlers[action.id] = fn
  }
  if (definition) definition(registerHandler)
  return perspective
}

const Remember = {
  that: item => ({
    is: value => ({ remember }) => remember(item, value),
  }),
}
const Recall = {
  about: item => ({ recall }) => recall(item),
}

const Memory = () => {
  const state = new Map()
  return {
    remember(item, value) {
      state.set(item, value)
    },
    recall(item) {
      if (!state.has(item))
        throw new Error(
          `I do not remember anything about '${item}', sorry.\n\nHere's what I *do* know about:\n${Array.from(
            state.keys()
          )
            .map(name => `- ${name}`)
            .join('\n')}\n\nWhy not ask me about those things instead?`
        )
      return state.get(item)
    },
  }
}

module.exports = {
  Actor,
  Memory,
  Perspective,
  Remember,
  Recall,
  Task,
}
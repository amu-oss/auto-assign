import { Context } from 'probot'
import { handlePullRequest } from '../src/handler'
import { PullRequest } from '../src/pull_request'

describe('handlePullRequest', () => {
  let event: any
  let context: Context

  beforeEach(async () => {
    event = {
      id: '123',
      name: 'pull_request',
      payload: {
        action: 'opened',
        number: '1',
        pull_request: {
          title: 'test'
        },
        repository: {
          name: 'auto-assign',
          owner: {
            login: 'kentaro-m'
          }
        }
      }
    }

    context = new Context(event, {} as any, {} as any)

    context.config = jest.fn().mockImplementation(async () => {
      return {
        addAssignees: true,
        addReviewers: true,
        numberOfReviewers: 0,
        reviewers: ['reviewer1', 'reviewer2', 'reviewer3'],
        skipKeywords: ['wip']
      }
    })
    context.log = jest.fn() as any
  })

  test('responds with the error if the configuration file failed to load', async () => {
    try {
      // tslint:disable-next-line:no-empty
      context.config = jest.fn().mockImplementation(async () => {})
      await handlePullRequest(context)
    } catch (error) {
      expect(error).toEqual(new Error('the configuration file failed to load'))
    }
  })

  test('exits the process if pull requests include skip words in the title', async () => {
    const spy = jest.spyOn(context, 'log')

    event.payload.pull_request.title = 'wip test'
    await handlePullRequest(context)

    expect(spy).toBeCalled()
  })

  test('adds reviewers to pull requests if the configuration is enabled, but no assignees', async () => {
    context.config = jest.fn().mockImplementation(async () => {
      return {
        addAssignees: false,
        addReviewers: true,
        numberOfReviewers: 0,
        reviewers: ['reviewer1', 'reviewer2', 'reviewer3'],
        skipKeywords: ['wip']
      }
    })

    context.github.issues = {
      addAssigneesToIssue: jest.fn().mockImplementation(async (obj) => {
        expect(obj.assignees.length).toEqual(0)
      })
    } as any

    context.github.pullRequests = {
      createReviewRequest: jest.fn().mockImplementation(async (obj) => {
        expect(obj.reviewers.length).toEqual(3)
      })
    } as any

    await handlePullRequest(context)
  })

  test('adds assignees to pull requests if the configuration is enabled ', async () => {
    context.config = jest.fn().mockImplementation(async () => {
      return {
        addAssignees: true,
        addReviewers: false,
        numberOfReviewers: 0,
        reviewers: ['reviewer1', 'reviewer2', 'reviewer3'],
        skipKeywords: ['wip']
      }
    })

    context.github.issues = {
      addAssigneesToIssue: jest.fn().mockImplementation(async (obj) => {
        expect(obj.assignees.length).toEqual(3)
      })
    } as any

    context.github.pullRequests = {
      createReviewRequest: jest.fn().mockImplementation(async (obj) => {
        expect(obj.reviewers.length).toEqual(0)
      })
    } as any

    await handlePullRequest(context)
  })

  test('adds assignees to pull requests if the assigness are enabled explicitly', async () => {
    const spy = jest.spyOn(context, 'log')

    context.config = jest.fn().mockImplementation(async () => {
      return {
        addAssignees: true,
        addReviewers: false,
        assignees: ['assignee1'],
        numberOfAssignees: 1,
        numberOfReviewers: 0,
        reviewers: ['reviewer1', 'reviewer2', 'reviewer3'],
        skipKeywords: ['wip']
      }
    })

    context.github.issues = {
      addAssigneesToIssue: jest.fn().mockImplementation(async (obj) => {
        expect(obj.assignees && obj.assignees[0]).toEqual('assignee1')
      })
    } as any

    context.github.pullRequests = {
      createReviewRequest: jest.fn().mockImplementation(async (obj) => {
        expect(obj.reviewers.length).toEqual(0)
      })
    } as any

    await handlePullRequest(context)

    expect(spy).toBeCalled()
  })

  test('adds assignees to pull requests using the numberOfReviewers when numberOfAssignees is unspecified', async () => {
    const spy = jest.spyOn(context, 'log')

    context.config = jest.fn().mockImplementation(async () => {
      return {
        addAssignees: true,
        addReviewers: true,
        assignees: ['assignee1', 'assignee2', 'assignee3'],
        numberOfReviewers: 2,
        reviewers: ['reviewer1', 'reviewer2', 'reviewer3'],
        skipKeywords: ['wip']
      }
    })

    context.github.issues = {
      addAssigneesToIssue: jest.fn().mockImplementation(async (obj) => {
        expect(obj.assignees.length).toEqual(2)
      })
    } as any

    context.github.pullRequests = {
      createReviewRequest: jest.fn().mockImplementation(async (obj) => {
        expect(obj.reviewers.length).toEqual(2)
      })
    } as any

    await handlePullRequest(context)

    expect(spy).toBeCalled()
  })

  test('adds assignees to pull requests if throws error to add reviewers', async () => {
    const spy = jest.spyOn(PullRequest.prototype, 'addAssignees')

    context.config = jest.fn().mockImplementation(async () => {
      return {
        addAssignees: true,
        addReviewers: true,
        assignees: ['maintainerX', 'maintainerY'],
        numberOfReviewers: 0,
        reviewers: ['reviewerA', 'reviewerB'],
        skipKeywords: ['wip']
      }
    })

    context.github.issues = {
      // tslint:disable-next-line:no-empty
      addAssigneesToIssue: jest.fn().mockImplementation(async () => {})
    } as any

    context.github.pullRequests = {
      createReviewRequest: jest.fn().mockImplementation(async () => {
        throw new Error('Review cannot be requested from pull request author.')
      })
    } as any

    await handlePullRequest(context)

    expect(spy).toBeCalled()
    expect(spy.mock.calls[0][3]).toHaveLength(2)
  })

  test('adds reviewers to pull requests if throws error to add assignees', async () => {
    const spy = jest.spyOn(PullRequest.prototype, 'addReviewers')

    context.config = jest.fn().mockImplementation(async () => {
      return {
        addAssignees: true,
        addReviewers: true,
        assignees: ['maintainerX', 'maintainerY'],
        numberOfReviewers: 0,
        reviewers: ['reviewerA', 'reviewerB'],
        skipKeywords: ['wip']
      }
    })

    context.github.issues = {
      addAssigneesToIssue: jest.fn().mockImplementation(async () => {
        throw new Error('failed to add assignees.')
      })
    } as any

    context.github.pullRequests = {
      // tslint:disable-next-line:no-empty
      createReviewRequest: jest.fn().mockImplementation(async () => {})
    } as any

    await handlePullRequest(context)

    expect(spy).toBeCalled()
    expect(spy.mock.calls[0][3]).toHaveLength(2)
  })
})

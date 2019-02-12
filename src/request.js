import * as helpers from './helpers'

let retry = 0
export default function request(config) {
  // TODO: keep origin config
  if (!retry && config.retry !== undefined) {
    retry = config.retry
  }
  let {
    transformRequest,
    transformResponse,
    method,
    data,
    params,
    paramsSerializer,
    url,
    baseURL,
  } = config

  if (
    Array.isArray(transformRequest) &&
    transformRequest.length &&
    (method === 'put' || method === 'post')
  ) {
    config.data = transformRequest.reduce((_data, fn) => {
      return fn(_data, config.headers) || _data
    }, data)
  }

  url = helpers.isAbsoluteURL(url) ? url : helpers.combineURL(baseURL, url)
  config.url = helpers.buildURL(url, params, paramsSerializer)
  config.method = method.toUpperCase()
  config = helpers.getWxConfig(config)

  let requestTask = null
  const onRequest = () =>
    new Promise((resolve, reject) => {
      requestTask = wx.request({
        ...config,
        success: res => {
          if (Array.isArray(transformResponse) && transformResponse.length) {
            res = transformResponse.reduce((_res, fn) => fn(_res) || _res, res)
          }
          resolve(res)
        },
        fail: res => {
          reject(res)
        },
      })
    })
  const onReject = () =>
    new Promise((_, reject) => {
      setTimeout(
        () => reject(new Error('timeout of ' + config.timeout + 'ms exceeded')),
        config.timeout
      )
    })

  return Promise.race([onRequest(), onReject()]).catch(e => {
    if (e instanceof Error && e.message.includes('timeout of')) {
      if (requestTask) {
        requestTask.abort()
        e.message = e.message + ' and the request has aborted'

        if (retry > 0 && retry--) {
          return request(config)
        }
      }
    }
    throw e
  })
}

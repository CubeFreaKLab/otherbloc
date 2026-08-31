import { getServiceStatus } from '../services/getServiceStatus.js'

export const resolvers = {
  Query: {
    serviceStatus: () => getServiceStatus(),
  },
}

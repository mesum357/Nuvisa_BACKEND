import { Transaction } from "sequelize"
import { callHTTPException } from "../exceptions"

export const transactionCommit = async (transaction: Transaction) => {
    try {
        await transaction.commit()
    } 
    catch (error) {
        callHTTPException(error.message)
    }
}


export const transactionRollback = async (transaction: Transaction) => {
    try {
        await transaction.rollback()
    } 
    catch (error) {
        callHTTPException(error.message)
    }
}
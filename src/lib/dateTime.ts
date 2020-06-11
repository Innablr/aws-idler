import * as moment from 'moment-timezone';
import log from './logger';

class DateTime {
    private currentTime: moment.Moment | undefined;

    freezeTime(t: string) {
        this.currentTime = moment.utc(t);
        log.info('Freezing time: %s', this.currentTime);
    }

    getTime(tz?: string) {
        if (this.currentTime === undefined) {
            throw new Error('Requested current time before initialising');
        }
        if (tz) {
            return this.currentTime.clone().tz(tz);
        }
        return this.currentTime.clone();
    }
}

export default new DateTime();

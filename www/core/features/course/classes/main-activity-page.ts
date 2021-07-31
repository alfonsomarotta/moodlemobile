// (C) Copyright 2015 Moodle Pty Ltd.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

import { Component, OnInit } from '@angular/core';
import { CoreNavigator } from '@services/navigator';
import { CoreCourseAnyModuleData } from '../services/course';
import { CoreCourseModuleMainResourceComponent } from './main-resource-component';

/**
/**
 * Template class to easily create CoreCourseModuleMainComponent of resources (or activities without syncing).
 */
@Component({
    template: '',
})
export class CoreCourseModuleMainActivityPage<ActivityType extends CoreCourseModuleMainResourceComponent> implements OnInit {

    activityComponent?: ActivityType;

    title!: string;
    module!: CoreCourseAnyModuleData;
    courseId!: number;


    /**
     * Component being initialized.
     */
    ngOnInit(): void {
        this.module = CoreNavigator.getRouteParam<CoreCourseAnyModuleData>('module')!;
        this.courseId = CoreNavigator.getRouteNumberParam('courseId')!;
        this.title = this.module?.name;
    }

    /**
     * Update some data based on the activity instance.
     *
     * @param activity Activity instance.
     */
    updateData(activity: { name: string}): void {
        this.title = activity.name || this.title;
    }

    /**
     * User entered the page.
     */
    ionViewDidEnter(): void {
        this.activityComponent?.ionViewDidEnter();
    }

    /**
     * User left the page.
     */
    ionViewDidLeave(): void {
        this.activityComponent?.ionViewDidLeave();
    }

}
